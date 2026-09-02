using System.Net;
using Windows.Devices.Bluetooth;
using Windows.Devices.Enumeration;

namespace SoundConnect.Companion;

/// <summary>
/// Phase 02: real Bluetooth events routed through the connection state machine.
///
///   soundconnect --selftest      deterministic state-machine checks, no hardware
///   soundconnect [seconds]       live watch, default 120s
///
/// Playback, assignments and the API server are later phases. This layer's only job
/// is to turn adapter noise into a correct sequence of sessions.
/// </summary>
internal static class Program
{
    private static readonly List<BluetoothDevice> Tracked = new();
    private static readonly Dictionary<string, string> Names = new();
    private static ConnectionStateMachine _machine = new();
    private static DateTimeOffset _startedAt;

    private static async Task<int> Main(string[] args)
    {
        if (args.Length > 0 && args[0].Equals("--selftest", StringComparison.OrdinalIgnoreCase))
        {
            return SelfTest.Run();
        }

        if (args.Length > 0 && args[0].Equals("--audio", StringComparison.OrdinalIgnoreCase))
        {
            return await ShowAudioEndpointsAsync();
        }

        // --assign <deviceNameFragment> <wavPath> [volume] [maxMs]
        if (args.Length > 2 && args[0].Equals("--assign", StringComparison.OrdinalIgnoreCase))
        {
            return await AssignAsync(
                args[1],
                args[2],
                args.Length > 3 && int.TryParse(args[3], out var av) ? av : 80,
                args.Length > 4 && int.TryParse(args[4], out var am) ? am : 4700);
        }

        // --simulate <deviceNameFragment>
        if (args.Length > 1 && args[0].Equals("--simulate", StringComparison.OrdinalIgnoreCase))
        {
            return await SimulateArrivalAsync(args[1]);
        }

        if (args.Length > 0 && args[0].Equals("--list", StringComparison.OrdinalIgnoreCase))
        {
            var store = new LocalStore();
            Console.WriteLine($"store: {store.Root}");
            foreach (var a in store.LoadAssignments())
            {
                Console.WriteLine($"  {a.DeviceName,-24} -> {a.SoundFile}  vol={a.Volume}%  cap={a.MaxDurationMs}ms  autoPlay={a.AutoPlay}");
            }
            return 0;
        }

        // --play <wavPath> [deviceNameFragment] [volume] [maxMs]
        if (args.Length > 1 && args[0].Equals("--play", StringComparison.OrdinalIgnoreCase))
        {
            return await PlayToDeviceAsync(
                args[1],
                args.Length > 2 ? args[2] : null,
                args.Length > 3 && int.TryParse(args[3], out var v) ? v : 80,
                args.Length > 4 && int.TryParse(args[4], out var m) ? m : 4700);
        }

        // Default: run as the service. Optional first arg caps the run for testing;
        // omitted means run until stopped, which is how it ships.
        int? runSeconds = args.Length > 0 && int.TryParse(args[0], out var s) ? s : null;
        var settle = args.Length > 1 && double.TryParse(args[1], out var sec)
            ? TimeSpan.FromSeconds(sec)
            : TimeSpan.FromMilliseconds(250);

        return await RunServiceAsync(runSeconds, settle);
    }

    private static CompanionState _state = new();
    private static readonly LocalStore Store = new();
    private static readonly AudioEndpointResolver Resolver = new();

    /// <summary>
    /// The companion proper: watches Bluetooth, owns device state, plays assigned sounds,
    /// and serves the dashboard over loopback. Everything the product does at runtime.
    /// </summary>
    private static async Task<int> RunServiceAsync(int? runSeconds, TimeSpan settle)
    {
        _machine = new ConnectionStateMachine(settle);
        _startedAt = DateTimeOffset.Now;
        _state = new CompanionState();

        using var api = new ApiServer(_state, Store);
        try
        {
            api.Start();
        }
        catch (HttpListenerException ex)
        {
            Console.WriteLine($"Could not bind {api.Url} — {ex.Message}");
            Console.WriteLine("Another companion instance is probably already running.");
            return 5;
        }

        Console.WriteLine("SoundConnect companion");
        Console.WriteLine($"  api    {api.Url}");
        Console.WriteLine($"  store  {Store.Root}");
        Console.WriteLine($"  settle {settle.TotalSeconds:F1}s");
        Console.WriteLine(new string('-', 78));

        _state.Emit("WATCHER_STARTED", message: "Windows Bluetooth DeviceWatcher active");

        // A live DeviceWatcher rather than a one-shot lookup: a device paired while the
        // companion is running must appear on its own, with no restart and no user action.
        var watcher = DeviceInformation.CreateWatcher(BluetoothDevice.GetDeviceSelector());

        watcher.Added += (sender, di) => { _ = AddDeviceAsync(di); };
        watcher.Removed += (_, upd) => RemoveDevice(upd.Id);
        watcher.Updated += (sender, upd) => { _ = RefreshPairingAsync(upd.Id); };
        watcher.EnumerationCompleted += (_, _) =>
            _state.Emit("ENUMERATION_COMPLETED", message: "initial Windows enumeration finished");
        watcher.Stopped += (_, _) => _state.Emit("WATCHER_STOPPED");

        watcher.Start();

        Console.WriteLine(new string('-', 78));
        Console.WriteLine(runSeconds is null
            ? "Running. Connect a device to trigger its sound. Ctrl+C to stop."
            : $"Running for {runSeconds}s.");
        Console.WriteLine();

        var deadline = runSeconds is { } rs ? DateTime.UtcNow.AddSeconds(rs) : DateTime.MaxValue;
        while (DateTime.UtcNow < deadline)
        {
            if (!Console.IsInputRedirected && Console.KeyAvailable) { Console.ReadKey(true); break; }
            await Task.Delay(200);
        }

        Console.WriteLine();
        Console.WriteLine($"SESSIONS MINTED: {_sessionCount}   FLAPS SUPPRESSED: {_flapCount}");
        return 0;
    }

    /// <summary>
    /// Brings a device Windows just reported into the companion's world: snapshot, existing
    /// assignment, connection subscription. Runs for devices already paired at startup and
    /// for ones paired later — the watcher does not distinguish, and neither should this.
    /// </summary>
    private static async Task AddDeviceAsync(DeviceInformation di)
    {
        if (_state.Get(di.Id) is not null) return; // already known

        BluetoothDevice? dev;
        try { dev = await BluetoothDevice.FromIdAsync(di.Id); }
        catch { return; }
        if (dev is null) return;

        lock (Tracked)
        {
            if (Names.ContainsKey(dev.DeviceId)) return;
            Tracked.Add(dev);
            Names[dev.DeviceId] = dev.Name;
        }

        bool connected = dev.ConnectionStatus == BluetoothConnectionStatus.Connected;
        bool paired = dev.DeviceInformation.Pairing.IsPaired;

        var snapshot = new DeviceSnapshot
        {
            Id = dev.DeviceId,
            Name = dev.Name,
            Paired = paired,
            Connected = connected,
            ConnectionState = (connected ? DeviceConnectionState.Connected
                              : paired ? DeviceConnectionState.Paired
                              : DeviceConnectionState.Nearby).ToString(),
            Category = CompanionState.GuessCategory(dev.Name)
        };

        // Carry over any sound this device was already given. Assignments are keyed by
        // stable id, so this survives renames, restarts and re-pairing.
        var a = Store.ForDevice(dev.DeviceId);
        if (a is not null)
        {
            snapshot.SoundFile = a.SoundFile;
            snapshot.SoundName = a.SoundName;
            snapshot.Volume = a.Volume;
            snapshot.MaxDurationMs = a.MaxDurationMs;
            snapshot.AutoPlay = a.AutoPlay;
        }

        _state.Upsert(snapshot);

        // Seed without treating an already-connected device as a fresh arrival —
        // otherwise every service restart would replay everyone's sound.
        _machine.Observe(dev.DeviceId, connected, DateTimeOffset.Now);

        _state.Emit("DEVICE_ADDED", dev.DeviceId, dev.Name,
            $"{snapshot.ConnectionState}, paired={paired}" +
            (a is not null ? $", sound={a.SoundFile}" : ", no sound assigned"));

        dev.ConnectionStatusChanged += OnConnectionStatusChanged;

        if (connected) await RefreshEndpointAsync(dev.DeviceId, dev.Name);
    }

    private static void RemoveDevice(string deviceId)
    {
        var name = Names.GetValueOrDefault(deviceId);
        _state.Emit("DEVICE_REMOVED", deviceId, name);
    }

    /// <summary>Pairing can change while the companion runs — unpair, re-pair, forget.</summary>
    private static async Task RefreshPairingAsync(string deviceId)
    {
        var known = _state.Get(deviceId);
        if (known is null) return;

        BluetoothDevice? dev;
        try { dev = await BluetoothDevice.FromIdAsync(deviceId); }
        catch { return; }
        if (dev is null) return;

        bool paired = dev.DeviceInformation.Pairing.IsPaired;
        if (paired == known.Paired) return;

        _state.Update(deviceId, d =>
        {
            d.Paired = paired;
            if (!d.Connected)
            {
                d.ConnectionState = (paired ? DeviceConnectionState.Paired
                                            : DeviceConnectionState.Nearby).ToString();
            }
        });

        _state.Emit("PAIRING_CHANGED", deviceId, dev.Name, $"paired={paired}");
    }

    /// <summary>Resolves the audio endpoint and records it, honestly, on the snapshot.</summary>
    private static async Task RefreshEndpointAsync(string deviceId, string deviceName)
    {
        var ep = await Resolver.ResolveForDeviceAsync(deviceName, TimeSpan.FromSeconds(6));

        _state.Update(deviceId, d =>
        {
            d.AudioEndpointId = ep?.Id;
            d.AudioEndpointName = ep?.Name;
            d.AudioAvailable = ep is not null && ep.Enabled;
        });

        if (ep is not null)
        {
            _state.Emit("AUDIO_ENDPOINT_FOUND", deviceId, deviceName, ep.Name);
        }
        else
        {
            _state.Emit("AUDIO_ENDPOINT_UNAVAILABLE", deviceId, deviceName,
                "connected, audio output not available");
        }
    }

    private static int _sessionCount;
    private static int _flapCount;

    /// <summary>
    /// Drives a real device through the state machine as if it had just arrived, then runs
    /// the production arrival handler unchanged.
    ///
    /// Everything here is real except the origin of the trigger: real device identity, real
    /// session minting, real assignment lookup, real endpoint resolution, real playback. It
    /// exists because the WinRT event itself is already proven separately, so this closes
    /// the remaining gap without needing anyone to physically toggle an earbud.
    /// </summary>
    private static async Task<int> SimulateArrivalAsync(string deviceFragment)
    {
        var found = await DeviceInformation.FindAllAsync(BluetoothDevice.GetDeviceSelector());

        foreach (var di in found)
        {
            BluetoothDevice? dev;
            try { dev = await BluetoothDevice.FromIdAsync(di.Id); } catch { continue; }
            if (dev is null) continue;
            if (!dev.Name.Contains(deviceFragment, StringComparison.OrdinalIgnoreCase)) continue;

            Console.WriteLine($"device : {dev.Name}");
            Console.WriteLine($"bt     : {dev.ConnectionStatus}");
            Console.WriteLine();

            var machine = new ConnectionStateMachine(TimeSpan.FromSeconds(3));

            // Seed as disconnected far enough back that the arrival is not read as a flap.
            machine.Observe(dev.DeviceId, false, DateTimeOffset.Now.AddSeconds(-30));
            var t = machine.Observe(dev.DeviceId, true, DateTimeOffset.Now);

            Console.WriteLine($"  CONNECTION_STATUS_CHANGED  {dev.Name}  Disconnected -> Connected");
            if (t.Kind != TransitionKind.NewConnection || t.SessionId is null)
            {
                Console.WriteLine($"  state machine returned {t.Kind} — expected NewConnection");
                return 4;
            }

            Console.WriteLine($"           CONNECTION_SESSION_CREATED  {t.SessionId}");
            await HandleArrivalAsync(dev.DeviceId, dev.Name, t.SessionId);

            // The one-per-session guard: a second report while still connected must do nothing.
            var again = machine.Observe(dev.DeviceId, true, DateTimeOffset.Now);
            Console.WriteLine();
            Console.WriteLine($"  repeat report while connected -> {again.Kind} (no second playback)");

            return 0;
        }

        Console.WriteLine($"No paired device matching '{deviceFragment}'.");
        return 2;
    }

    /// <summary>Assigns a sound to a device by stable id, copying the file into the store.</summary>
    private static async Task<int> AssignAsync(
        string deviceFragment, string wavPath, int volume, int maxMs)
    {
        if (!File.Exists(wavPath))
        {
            Console.WriteLine($"No such file: {wavPath}");
            return 2;
        }

        var found = await DeviceInformation.FindAllAsync(BluetoothDevice.GetDeviceSelector());
        foreach (var di in found)
        {
            BluetoothDevice? dev;
            try { dev = await BluetoothDevice.FromIdAsync(di.Id); } catch { continue; }
            if (dev is null) continue;
            if (!dev.Name.Contains(deviceFragment, StringComparison.OrdinalIgnoreCase)) continue;

            var store = new LocalStore();
            var a = store.Assign(dev.DeviceId, dev.Name, wavPath, volume, maxMs);

            Console.WriteLine($"assigned  {a.DeviceName}  ->  {a.SoundFile}");
            Console.WriteLine($"  volume  {a.Volume}%   cap {a.MaxDurationMs}ms");
            Console.WriteLine($"  id      {a.DeviceId}");
            Console.WriteLine($"  stored  {store.SoundPath(a)}");
            return 0;
        }

        Console.WriteLine($"No paired device matching '{deviceFragment}'.");
        return 2;
    }

    /// <summary>
    /// Phase 06: the full chain, run on a genuine arrival. Every gate reports its own
    /// outcome, and nothing claims success it did not achieve.
    /// </summary>
    private static async Task HandleArrivalAsync(string deviceId, string deviceName, string sessionId)
    {
        var store = new LocalStore();
        var assignment = store.ForDevice(deviceId);

        if (assignment is null)
        {
            Console.WriteLine($"           SKIPPED — no assignment for this device");
            return;
        }

        if (!assignment.AutoPlay)
        {
            Console.WriteLine($"           SKIPPED — autoPlay is off");
            return;
        }

        Console.WriteLine($"           ASSIGNMENT_FOUND  {assignment.SoundFile}");

        var endpoint = await new AudioEndpointResolver().ResolveForDeviceAsync(
            deviceName, TimeSpan.FromSeconds(8), m => Console.WriteLine($"           {m}"));

        if (endpoint is null)
        {
            Console.WriteLine($"           CONNECTED, AUDIO OUTPUT UNAVAILABLE — no playback claimed");
            return;
        }

        var result = await new Player().PlayAsync(
            endpoint,
            store.SoundPath(assignment),
            assignment.Volume,
            assignment.MaxDurationMs,
            m => Console.WriteLine($"           {m}"));

        if (result.Outcome != PlaybackOutcome.Started)
        {
            Console.WriteLine($"           PLAYBACK_FAILED  {result.Outcome} — {result.Error}");
        }
    }

    /// <summary>
    /// Phase 05 check: play a file to the endpoint of a currently connected Bluetooth
    /// device. Proves the sound lands in the earbuds rather than the laptop speakers.
    /// </summary>
    private static async Task<int> PlayToDeviceAsync(
        string wavPath, string? deviceFragment, int volume, int maxMs)
    {
        var resolver = new AudioEndpointResolver();

        // Pick the connected Bluetooth device, or the one whose name matches the fragment.
        var found = await DeviceInformation.FindAllAsync(BluetoothDevice.GetDeviceSelector());
        BluetoothDevice? target = null;

        foreach (var di in found)
        {
            BluetoothDevice? dev;
            try { dev = await BluetoothDevice.FromIdAsync(di.Id); } catch { continue; }
            if (dev is null) continue;
            if (dev.ConnectionStatus != BluetoothConnectionStatus.Connected) continue;

            if (deviceFragment is null ||
                dev.Name.Contains(deviceFragment, StringComparison.OrdinalIgnoreCase))
            {
                target = dev;
                break;
            }
        }

        if (target is null)
        {
            Console.WriteLine("No connected Bluetooth audio device found. Connect one and retry.");
            return 2;
        }

        Console.WriteLine($"device   : {target.Name}  (Connected)");

        var endpoint = await resolver.ResolveForDeviceAsync(
            target.Name, TimeSpan.FromSeconds(8), m => Console.WriteLine($"  {m}"));

        if (endpoint is null)
        {
            Console.WriteLine("=> Connected, audio output unavailable. Not claiming playback.");
            return 3;
        }

        Console.WriteLine($"endpoint : {endpoint.Name}");
        Console.WriteLine($"file     : {wavPath}");
        Console.WriteLine();

        var result = await new Player().PlayAsync(
            endpoint, wavPath, volume, maxMs, m => Console.WriteLine($"  {m}"));

        Console.WriteLine();
        Console.WriteLine($"OUTCOME  : {result.Outcome}{(result.Error is null ? "" : $" — {result.Error}")}");
        return result.Outcome == PlaybackOutcome.Started ? 0 : 4;
    }

    /// <summary>
    /// Diagnostic: dump every render endpoint Windows reports, and show which one the
    /// resolver would pick for each paired Bluetooth device. Run this before trusting
    /// the matcher — endpoint naming varies by driver.
    /// </summary>
    private static async Task<int> ShowAudioEndpointsAsync()
    {
        var resolver = new AudioEndpointResolver();
        var endpoints = await resolver.ListRenderEndpointsAsync();

        Console.WriteLine($"AUDIO RENDER ENDPOINTS: {endpoints.Count}");
        Console.WriteLine(new string('-', 78));
        foreach (var ep in endpoints)
        {
            Console.WriteLine($"  {(ep.Enabled ? "enabled " : "disabled")}  {ep.Name}");
            Console.WriteLine($"            id={ep.Id}");
        }

        Console.WriteLine();
        Console.WriteLine("MATCHING against paired Bluetooth devices");
        Console.WriteLine(new string('-', 78));

        var found = await DeviceInformation.FindAllAsync(BluetoothDevice.GetDeviceSelector());
        foreach (var di in found)
        {
            BluetoothDevice? dev;
            try { dev = await BluetoothDevice.FromIdAsync(di.Id); } catch { continue; }
            if (dev is null) continue;

            var match = resolver.Match(dev.Name, endpoints);
            var connected = dev.ConnectionStatus == BluetoothConnectionStatus.Connected;

            Console.WriteLine($"  {dev.Name,-24} bt={(connected ? "Connected" : "Disconnected"),-13} " +
                              $"-> {(match is null ? "<no endpoint>" : match.Name)}");
        }

        return 0;
    }

    private static void OnConnectionStatusChanged(BluetoothDevice sender, object args)
    {
        bool connected = sender.ConnectionStatus == BluetoothConnectionStatus.Connected;
        var t = _machine.Observe(sender.DeviceId, connected, DateTimeOffset.Now);
        var name = Names.GetValueOrDefault(sender.DeviceId, sender.Name);
        var stamp = $"[{(DateTimeOffset.Now - _startedAt).TotalSeconds,7:F1}s]";

        // Keep the published snapshot in step with reality before anything else.
        _state.Update(sender.DeviceId, d =>
        {
            d.Connected = connected;
            d.ConnectionState = (connected ? DeviceConnectionState.Connected
                                : d.Paired ? DeviceConnectionState.Paired
                                : DeviceConnectionState.Nearby).ToString();

            if (connected)
            {
                d.LastConnectedAt = DateTimeOffset.Now.ToUnixTimeMilliseconds();
            }
            else
            {
                d.LastDisconnectedAt = DateTimeOffset.Now.ToUnixTimeMilliseconds();
                // The endpoint goes away with the link — do not keep claiming it exists.
                d.AudioEndpointId = null;
                d.AudioEndpointName = null;
                d.AudioAvailable = false;
            }
        });

        switch (t.Kind)
        {
            case TransitionKind.NewConnection:
                Interlocked.Increment(ref _sessionCount);
                _state.Emit("CONNECTION_STATUS_CHANGED", sender.DeviceId, name, "Disconnected -> Connected");
                _state.Emit("CONNECTION_SESSION_CREATED", sender.DeviceId, name, t.SessionId);
                // Must not block the WinRT event thread, or later transitions queue up
                // behind playback. Faults are caught and logged rather than discarded —
                // an unobserved task exception here would look exactly like "the sound
                // just didn't play", which is the failure mode hardest to diagnose.
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await HandleArrivalAsync(sender.DeviceId, name, t.SessionId!);
                    }
                    catch (Exception ex)
                    {
                        _state.Emit("PLAYBACK_FAILED", sender.DeviceId, name,
                            $"{ex.GetType().Name}: {ex.Message}");
                    }
                });
                break;

            case TransitionKind.Disconnected:
                _state.Emit("CONNECTION_STATUS_CHANGED", sender.DeviceId, name, "Connected -> Disconnected");
                break;

            case TransitionKind.Flap:
                Interlocked.Increment(ref _flapCount);
                _state.Emit("CONNECTION_FLAP_IGNORED", sender.DeviceId, name,
                    $"back after {t.GapSinceDisconnect?.TotalSeconds:F1}s — no session");
                break;

            case TransitionKind.Ignored:
                break;
        }

        // The endpoint is torn down on disconnect and rebuilt on reconnect. Without this
        // the snapshot keeps reporting "audio output unavailable" for a device that is
        // connected and working — true at the moment it dropped, false ever after.
        // Runs for every kind of reconnect, flaps included: a suppressed flap still means
        // the device is back and its endpoint is real.
        if (connected)
        {
            _ = Task.Run(() => RefreshEndpointAsync(sender.DeviceId, name));
        }
    }
}

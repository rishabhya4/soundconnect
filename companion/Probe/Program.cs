using Windows.Devices.Bluetooth;
using Windows.Devices.Enumeration;

namespace SoundConnect.Probe;

/// <summary>
/// Phase 01 probe. Establishes, against real hardware, whether the WinRT stack
/// reports Bluetooth pairing and connection truthfully on this machine.
///
/// It answers three questions and nothing else:
///   1. Does DeviceInformation enumerate the paired audio devices?
///   2. Does BluetoothDevice.ConnectionStatus match physical reality?
///   3. Does ConnectionStatusChanged fire on connect/disconnect, and how fast?
///
/// No assignments, no audio, no storage. If this does not work, nothing built
/// on top of it would either.
/// </summary>
internal static class Program
{
    // BluetoothDevice instances must be held for the lifetime of the watch.
    // If they are collected, ConnectionStatusChanged silently stops firing —
    // this is the single most common reason a WinRT Bluetooth watcher "works"
    // and then goes quiet after a few seconds.
    private static readonly List<BluetoothDevice> Tracked = new();
    private static readonly Dictionary<string, BluetoothConnectionStatus> LastStatus = new();
    private static readonly object Gate = new();

    private static DateTimeOffset _startedAt;

    // A parallel low-frequency poll runs alongside the event subscription purely as a
    // control. It is NOT how the product will detect connections — it exists so that a
    // silent run can be diagnosed: if the poll sees a change the event did not report,
    // ConnectionStatusChanged is unreliable on this adapter and the AEP path is needed.
    private static readonly Dictionary<string, BluetoothConnectionStatus> PolledStatus = new();
    private static int _eventCount;
    private static int _polledChangeCount;

    private static async Task<int> Main(string[] args)
    {
        int watchSeconds = 60;
        if (args.Length > 0 && int.TryParse(args[0], out var parsed))
        {
            watchSeconds = parsed;
        }

        _startedAt = DateTimeOffset.Now;

        Console.WriteLine("SoundConnect — Phase 01 WinRT probe");
        Console.WriteLine($"OS: {Environment.OSVersion.Version}   watch window: {watchSeconds}s");
        Console.WriteLine(new string('-', 78));

        string selector;
        try
        {
            selector = BluetoothDevice.GetDeviceSelector();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"FATAL: could not build the Bluetooth AQS selector — {ex.GetType().Name}: {ex.Message}");
            return 1;
        }

        DeviceInformationCollection found;
        try
        {
            found = await DeviceInformation.FindAllAsync(selector);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"FATAL: FindAllAsync failed — {ex.GetType().Name}: {ex.Message}");
            return 1;
        }

        Console.WriteLine($"ENUMERATION: {found.Count} Bluetooth device record(s)");
        Console.WriteLine();

        foreach (var di in found)
        {
            await InspectAsync(di);
        }

        if (Tracked.Count == 0)
        {
            Console.WriteLine("No BluetoothDevice could be opened. ConnectionStatus is unavailable on this adapter.");
            return 2;
        }

        Console.WriteLine(new string('-', 78));
        Console.WriteLine("WATCHING. Connect and disconnect a device now — transitions print below.");
        Console.WriteLine("Press any key to stop early.");
        Console.WriteLine();

        var watcher = StartWatcher(selector);

        lock (Gate)
        {
            foreach (var dev in Tracked) PolledStatus[dev.DeviceId] = dev.ConnectionStatus;
        }

        var deadline = DateTime.UtcNow.AddSeconds(watchSeconds);
        var nextPoll = DateTime.UtcNow.AddSeconds(2);
        var nextBeat = DateTime.UtcNow.AddSeconds(10);

        while (DateTime.UtcNow < deadline)
        {
            // KeyAvailable throws when stdin is redirected (any non-interactive host).
            if (!Console.IsInputRedirected && Console.KeyAvailable) { Console.ReadKey(true); break; }

            if (DateTime.UtcNow >= nextPoll)
            {
                nextPoll = DateTime.UtcNow.AddSeconds(2);
                PollForMissedChanges();
            }

            if (DateTime.UtcNow >= nextBeat)
            {
                nextBeat = DateTime.UtcNow.AddSeconds(10);
                var left = (deadline - DateTime.UtcNow).TotalSeconds;
                Console.WriteLine($"  [{Elapsed(),7:F1}s] ...watching, {left:F0}s left — toggle a device now");
            }

            await Task.Delay(150);
        }

        try { watcher.Stop(); } catch { /* watcher may already be stopped */ }

        Console.WriteLine();
        Console.WriteLine(new string('-', 78));
        Console.WriteLine("FINAL STATE");
        foreach (var dev in Tracked)
        {
            Console.WriteLine($"  {dev.Name,-34} {dev.ConnectionStatus}");
        }

        Console.WriteLine();
        Console.WriteLine("VERDICT");
        Console.WriteLine($"  ConnectionStatusChanged events : {_eventCount}");
        Console.WriteLine($"  Changes seen by control poll   : {_polledChangeCount}");

        if (_eventCount > 0)
        {
            Console.WriteLine("  => PASS. Event-driven detection works on this adapter.");
        }
        else if (_polledChangeCount > 0)
        {
            Console.WriteLine("  => FAIL. State changed but no event fired — use the AEP watcher path instead.");
        }
        else
        {
            Console.WriteLine("  => INCONCLUSIVE. Nothing changed during the window; no device was toggled.");
        }

        return 0;
    }

    private static async Task InspectAsync(DeviceInformation di)
    {
        // Pairing must come from the opened device's own DeviceInformation.
        // Two traps found on this hardware, both silent:
        //   - di.Pairing.IsPaired on the BluetoothDevice selector returns False
        //     for genuinely paired devices.
        //   - AssociationEndpoint records returned by
        //     GetDeviceSelectorFromPairingState(true) — i.e. already filtered to
        //     paired — also report Pairing.IsPaired == False.
        // Only BluetoothDevice.DeviceInformation.Pairing.IsPaired is truthful.
        bool paired = false;
        string status;
        string idShown = di.Id;

        try
        {
            var dev = await BluetoothDevice.FromIdAsync(di.Id);
            if (dev is null)
            {
                status = "<FromIdAsync returned null>";
            }
            else
            {
                status = dev.ConnectionStatus.ToString();

                // The documented path: pairing off the device's own DeviceInformation.
                try
                {
                    paired = dev.DeviceInformation.Pairing.IsPaired;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"      (dev.DeviceInformation.Pairing failed: {ex.GetType().Name})");
                }

                lock (Gate)
                {
                    Tracked.Add(dev);
                    LastStatus[dev.DeviceId] = dev.ConnectionStatus;
                }

                dev.ConnectionStatusChanged += OnConnectionStatusChanged;
            }
        }
        catch (Exception ex)
        {
            status = $"<{ex.GetType().Name}>";
        }

        Console.WriteLine($"  {di.Name}");
        Console.WriteLine($"      paired    : {paired}");
        Console.WriteLine($"      connected : {status}");
        Console.WriteLine($"      stable id : {idShown}");
        Console.WriteLine();
    }

    private static void OnConnectionStatusChanged(BluetoothDevice sender, object args)
    {
        BluetoothConnectionStatus previous;
        var current = sender.ConnectionStatus;

        lock (Gate)
        {
            LastStatus.TryGetValue(sender.DeviceId, out previous);
            LastStatus[sender.DeviceId] = current;
        }

        // This is the transition the whole product hangs on. Print it with an
        // elapsed stamp so latency against the physical action is measurable.
        Interlocked.Increment(ref _eventCount);

        var elapsed = (DateTimeOffset.Now - _startedAt).TotalSeconds;
        Console.WriteLine($"  [{elapsed,7:F1}s] CONNECTION_STATUS_CHANGED  {sender.Name}");
        Console.WriteLine($"             {previous} -> {current}   <-- EVENT FIRED");
    }

    /// <summary>
    /// Control poll. Anything reported here that the event did not report is evidence
    /// that ConnectionStatusChanged cannot be relied on for this adapter.
    /// </summary>
    private static void PollForMissedChanges()
    {
        lock (Gate)
        {
            foreach (var dev in Tracked)
            {
                BluetoothConnectionStatus current;
                try { current = dev.ConnectionStatus; }
                catch { continue; }

                if (!PolledStatus.TryGetValue(dev.DeviceId, out var previous) || previous == current)
                {
                    continue;
                }

                PolledStatus[dev.DeviceId] = current;
                _polledChangeCount++;

                Console.WriteLine($"  [{Elapsed(),7:F1}s] POLLED_CHANGE              {dev.Name}");
                Console.WriteLine($"             {previous} -> {current}   (events so far: {_eventCount})");
            }
        }
    }

    private static DeviceWatcher StartWatcher(string selector)
    {
        var watcher = DeviceInformation.CreateWatcher(
            selector,
            new[] { "System.Devices.Aep.IsConnected", "System.Devices.Aep.IsPaired" },
            DeviceInformationKind.AssociationEndpoint);

        watcher.Added += (_, di) =>
            Console.WriteLine($"  [{Elapsed(),7:F1}s] DEVICE_ADDED               {di.Name}");

        watcher.Removed += (_, upd) =>
            Console.WriteLine($"  [{Elapsed(),7:F1}s] DEVICE_REMOVED             {upd.Id}");

        watcher.Updated += (_, upd) =>
        {
            // The AEP property path is the fallback signal if ConnectionStatusChanged
            // proves unreliable on this adapter — worth seeing whether it fires.
            if (upd.Properties.TryGetValue("System.Devices.Aep.IsConnected", out var v))
            {
                Console.WriteLine($"  [{Elapsed(),7:F1}s] AEP_IsConnected            {v}   ({upd.Id})");
            }
        };

        watcher.EnumerationCompleted += (_, _) =>
            Console.WriteLine($"  [{Elapsed(),7:F1}s] ENUMERATION_COMPLETED");

        watcher.Stopped += (_, _) =>
            Console.WriteLine($"  [{Elapsed(),7:F1}s] WATCHER_STOPPED");

        watcher.Start();
        return watcher;
    }

    private static double Elapsed() => (DateTimeOffset.Now - _startedAt).TotalSeconds;
}

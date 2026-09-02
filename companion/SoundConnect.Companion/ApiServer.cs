using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SoundConnect.Companion;

/// <summary>
/// Loopback-only HTTP + WebSocket API for the dashboard.
///
/// Bound to 127.0.0.1 so nothing off-machine can reach it. The dashboard is a pure client:
/// it reads state and posts configuration, and has no role in Bluetooth monitoring or
/// playback. Closing the browser has no effect on the engine.
/// </summary>
public sealed class ApiServer : IDisposable
{
    public const int DefaultPort = 17385;

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly HttpListener _listener = new();
    private readonly CompanionState _state;
    private readonly LocalStore _store;
    private readonly List<WebSocket> _sockets = new();
    private readonly object _socketGate = new();
    private readonly int _port;

    public ApiServer(CompanionState state, LocalStore store, int port = DefaultPort)
    {
        _state = state;
        _store = store;
        _port = port;

        _listener.Prefixes.Add($"http://127.0.0.1:{port}/");
        _state.EventEmitted += evt => _ = BroadcastAsync(evt);
    }

    public string Url => $"http://127.0.0.1:{_port}";

    public void Start()
    {
        _listener.Start();
        _ = AcceptLoopAsync();
    }

    private async Task AcceptLoopAsync()
    {
        while (_listener.IsListening)
        {
            HttpListenerContext ctx;
            try { ctx = await _listener.GetContextAsync(); }
            catch (HttpListenerException) { return; }
            catch (ObjectDisposedException) { return; }

            _ = HandleAsync(ctx);
        }
    }

    private async Task HandleAsync(HttpListenerContext ctx)
    {
        try
        {
            // The dashboard may be served from localhost in development or from a hosted
            // origin in production; either way it is a browser talking to this machine.
            ctx.Response.AddHeader("Access-Control-Allow-Origin", "*");
            ctx.Response.AddHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
            ctx.Response.AddHeader("Access-Control-Allow-Headers", "Content-Type");

            // Private Network Access: a page on a public origin calling a loopback address
            // is preflighted by Chrome, and refused unless the response opts in. Without
            // this, a deployed dashboard cannot reach the companion at all.
            if (ctx.Request.Headers["Access-Control-Request-Private-Network"] is not null)
            {
                ctx.Response.AddHeader("Access-Control-Allow-Private-Network", "true");
            }

            if (ctx.Request.HttpMethod == "OPTIONS")
            {
                ctx.Response.StatusCode = 204;
                ctx.Response.Close();
                return;
            }

            var path = ctx.Request.Url?.AbsolutePath.TrimEnd('/') ?? "";

            if (path == "/api/events" && ctx.Request.IsWebSocketRequest)
            {
                await AcceptSocketAsync(ctx);
                return;
            }

            switch (ctx.Request.HttpMethod, path)
            {
                case ("GET", "/api/health"):
                    await WriteJsonAsync(ctx, new
                    {
                        status = "running",
                        startedAt = _state.StartedAt.ToString("o"),
                        uptimeSeconds = (int)(DateTimeOffset.Now - _state.StartedAt).TotalSeconds,
                        store = _store.Root
                    });
                    return;

                case ("GET", "/api/devices"):
                    await WriteJsonAsync(ctx, new { devices = _state.Devices });
                    return;

                case ("GET", "/api/events"):
                    await WriteJsonAsync(ctx, new { events = _state.RecentEvents });
                    return;

                case ("GET", "/api/assignments"):
                    await WriteJsonAsync(ctx, new { assignments = _store.LoadAssignments() });
                    return;

                case ("POST", "/api/assignments"):
                    await HandleAssignAsync(ctx);
                    return;
            }

            // POST /api/sounds/{deviceId}  — raw audio body, becomes that device's sound
            if (ctx.Request.HttpMethod == "POST" && path.StartsWith("/api/sounds/", StringComparison.Ordinal))
            {
                await HandleSoundUploadAsync(ctx, Uri.UnescapeDataString(path["/api/sounds/".Length..]));
                return;
            }

            ctx.Response.StatusCode = 404;
            await WriteJsonAsync(ctx, new { error = "not found", path });
        }
        catch (Exception ex)
        {
            try
            {
                ctx.Response.StatusCode = 500;
                await WriteJsonAsync(ctx, new { error = ex.Message });
            }
            catch { /* client already gone */ }
        }
    }

    private sealed class AssignRequest
    {
        public string DeviceId { get; set; } = "";
        public int? Volume { get; set; }
        public int? MaxDurationMs { get; set; }
        public bool? AutoPlay { get; set; }
    }

    private async Task HandleAssignAsync(HttpListenerContext ctx)
    {
        using var reader = new StreamReader(ctx.Request.InputStream, Encoding.UTF8);
        var body = await reader.ReadToEndAsync();
        var req = JsonSerializer.Deserialize<AssignRequest>(body, Json);

        if (req is null || string.IsNullOrWhiteSpace(req.DeviceId))
        {
            ctx.Response.StatusCode = 400;
            await WriteJsonAsync(ctx, new { error = "deviceId is required" });
            return;
        }

        var all = _store.LoadAssignments();
        var existing = all.FirstOrDefault(a =>
            string.Equals(a.DeviceId, req.DeviceId, StringComparison.OrdinalIgnoreCase));

        if (existing is null)
        {
            ctx.Response.StatusCode = 404;
            await WriteJsonAsync(ctx, new { error = "no sound uploaded for this device yet" });
            return;
        }

        if (req.Volume is { } v) existing.Volume = Math.Clamp(v, 0, 100);
        if (req.MaxDurationMs is { } m) existing.MaxDurationMs = Math.Clamp(m, 100, Assignment.MaxClipMs);
        if (req.AutoPlay is { } ap) existing.AutoPlay = ap;

        _store.SaveAssignments(all);
        SyncAssignmentIntoState(existing);
        _state.Emit("ASSIGNMENT_UPDATED", existing.DeviceId, existing.DeviceName);

        await WriteJsonAsync(ctx, new { assignment = existing });
    }

    private async Task HandleSoundUploadAsync(HttpListenerContext ctx, string deviceId)
    {
        var device = _state.Get(deviceId);
        if (device is null)
        {
            ctx.Response.StatusCode = 404;
            await WriteJsonAsync(ctx, new { error = "unknown device", deviceId });
            return;
        }

        // Buffer the upload to a temp file, then hand it to the store.
        var temp = Path.Combine(Path.GetTempPath(), $"sc-upload-{Guid.NewGuid():N}.wav");
        await using (var fs = File.Create(temp))
        {
            await ctx.Request.InputStream.CopyToAsync(fs);
        }

        try
        {
            var q = ctx.Request.QueryString;
            int volume = int.TryParse(q["volume"], out var vv) ? vv : 80;
            int maxMs = int.TryParse(q["maxDurationMs"], out var mm) ? mm : Assignment.MaxClipMs;

            var soundName = q["name"];
            var assignment = _store.Assign(deviceId, device.Name, temp, volume, maxMs, soundName);
            SyncAssignmentIntoState(assignment);
            _state.Emit("ASSIGNMENT_UPDATED", deviceId, device.Name, assignment.SoundName);

            await WriteJsonAsync(ctx, new { assignment });
        }
        finally
        {
            try { File.Delete(temp); } catch { /* best effort */ }
        }
    }

    private void SyncAssignmentIntoState(Assignment a)
        => _state.Update(a.DeviceId, d =>
        {
            d.SoundFile = a.SoundFile;
            d.SoundName = a.SoundName;
            d.Volume = a.Volume;
            d.MaxDurationMs = a.MaxDurationMs;
            d.AutoPlay = a.AutoPlay;
        });

    private async Task AcceptSocketAsync(HttpListenerContext ctx)
    {
        var wsCtx = await ctx.AcceptWebSocketAsync(null);
        var socket = wsCtx.WebSocket;

        lock (_socketGate) _sockets.Add(socket);

        // Send the current world immediately so a late subscriber is not blind.
        await SendAsync(socket, new { type = "snapshot", devices = _state.Devices });

        var buffer = new byte[1024];
        try
        {
            while (socket.State == WebSocketState.Open)
            {
                var r = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                if (r.MessageType == WebSocketMessageType.Close) break;
            }
        }
        catch { /* client vanished */ }
        finally
        {
            lock (_socketGate) _sockets.Remove(socket);
        }
    }

    public async Task BroadcastAsync(CompanionEvent evt)
    {
        List<WebSocket> targets;
        lock (_socketGate) targets = _sockets.Where(s => s.State == WebSocketState.Open).ToList();
        if (targets.Count == 0) return;

        var payload = new { type = "event", @event = evt, devices = _state.Devices };
        foreach (var s in targets)
        {
            try { await SendAsync(s, payload); } catch { /* dropped */ }
        }
    }

    private static async Task SendAsync(WebSocket socket, object payload)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(payload, Json);
        await socket.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
    }

    private static async Task WriteJsonAsync(HttpListenerContext ctx, object payload)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(payload, Json);
        ctx.Response.ContentType = "application/json";
        ctx.Response.ContentLength64 = bytes.Length;
        await ctx.Response.OutputStream.WriteAsync(bytes);
        ctx.Response.Close();
    }

    public void Dispose()
    {
        try { _listener.Stop(); _listener.Close(); } catch { /* already down */ }
    }
}

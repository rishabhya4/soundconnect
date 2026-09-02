using System.Collections.Concurrent;

namespace SoundConnect.Companion;

/// <summary>The four states the spec defines. Kept distinct — never collapsed into a boolean.</summary>
public enum DeviceConnectionState
{
    Connected,
    Paired,
    Nearby,
    Unavailable
}

public sealed class DeviceSnapshot
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public bool Paired { get; set; }
    public bool Connected { get; set; }
    public string ConnectionState { get; set; } = nameof(DeviceConnectionState.Unavailable);
    public string Category { get; set; } = "other";

    /// <summary>Opaque MMDevice endpoint id. Present only when an endpoint was actually resolved.</summary>
    public string? AudioEndpointId { get; set; }
    public string? AudioEndpointName { get; set; }

    /// <summary>Bluetooth connected does not imply this. Reported separately, on purpose.</summary>
    public bool AudioAvailable { get; set; }

    public string? SoundFile { get; set; }
    public string? SoundName { get; set; }
    public int Volume { get; set; } = 80;
    public int MaxDurationMs { get; set; } = 10000;
    public bool AutoPlay { get; set; } = true;

    public long? LastConnectedAt { get; set; }
    public long? LastDisconnectedAt { get; set; }
}

public sealed class CompanionEvent
{
    public string Type { get; set; } = "";
    public string? DeviceId { get; set; }
    public string? DeviceName { get; set; }
    public string? Message { get; set; }
    public string Timestamp { get; set; } = DateTimeOffset.Now.ToString("o");
}

/// <summary>
/// The companion's live view of the world, shared between the Bluetooth watcher and the
/// API server. This is the authority — the dashboard reads it, it never reads the dashboard.
/// </summary>
public sealed class CompanionState
{
    private readonly ConcurrentDictionary<string, DeviceSnapshot> _devices = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentQueue<CompanionEvent> _events = new();
    private const int EventRingSize = 200;

    public DateTimeOffset StartedAt { get; } = DateTimeOffset.Now;

    /// <summary>Raised for every emitted event so the API server can push it to subscribers.</summary>
    public event Action<CompanionEvent>? EventEmitted;

    public IReadOnlyList<DeviceSnapshot> Devices
        => _devices.Values.OrderBy(d => d.Name, StringComparer.OrdinalIgnoreCase).ToList();

    public IReadOnlyList<CompanionEvent> RecentEvents
        => _events.Reverse().ToList();

    public DeviceSnapshot Upsert(DeviceSnapshot snapshot)
    {
        _devices[snapshot.Id] = snapshot;
        return snapshot;
    }

    public DeviceSnapshot? Get(string deviceId)
        => _devices.TryGetValue(deviceId, out var d) ? d : null;

    public void Update(string deviceId, Action<DeviceSnapshot> mutate)
    {
        if (_devices.TryGetValue(deviceId, out var d)) mutate(d);
    }

    /// <summary>
    /// Emits an event. The name must describe something that actually happened — the whole
    /// point of this rebuild is that PLAYBACK_STARTED means playback started.
    /// </summary>
    public void Emit(string type, string? deviceId = null, string? deviceName = null, string? message = null)
    {
        var evt = new CompanionEvent
        {
            Type = type,
            DeviceId = deviceId,
            DeviceName = deviceName,
            Message = message
        };

        _events.Enqueue(evt);
        while (_events.Count > EventRingSize) _events.TryDequeue(out _);

        Console.WriteLine($"  {DateTimeOffset.Now:HH:mm:ss}  {type,-28} {deviceName ?? ""} {message ?? ""}".TrimEnd());
        EventEmitted?.Invoke(evt);
    }

    /// <summary>Category guessed from the name for display only. Never used for identity.</summary>
    public static string GuessCategory(string name)
    {
        var n = name.ToLowerInvariant();
        if (n.Contains("buds") || n.Contains("airdopes") || n.Contains("airpod") || n.Contains("ear"))
            return "earbuds";
        if (n.Contains("head") || n.Contains("wh-")) return "headphones";
        if (n.Contains("speaker") || n.Contains("flip") || n.Contains("boom")) return "speaker";
        if (n.Contains("car") || n.Contains("auto")) return "car";
        return "other";
    }
}

using System.Text.Json;
using System.Text.Json.Serialization;

namespace SoundConnect.Companion;

public sealed class Assignment
{
    /// <summary>Longest clip the product will play. Raised from 5s at the user's request.</summary>
    public const int MaxClipMs = 10000;

    /// <summary>Windows address-based device identity. Never a display name.</summary>
    public string DeviceId { get; set; } = "";

    /// <summary>Kept for display only. A rename here must not affect matching.</summary>
    public string DeviceName { get; set; } = "";

    /// <summary>File name inside the store's sounds directory.</summary>
    public string SoundFile { get; set; } = "";

    /// <summary>The name the user gave the clip, for display. Never used for matching.</summary>
    public string SoundName { get; set; } = "";

    public int Volume { get; set; } = 80;
    public int MaxDurationMs { get; set; } = 10000;
    public bool AutoPlay { get; set; } = true;
}

/// <summary>
/// The companion's own store, and the thing that makes the browser optional.
///
/// Assignments and audio files live on disk under %LOCALAPPDATA%, so playback needs
/// no browser tab, no IndexedDB and no web server. Closing Chrome, or never opening
/// it, changes nothing.
/// </summary>
public sealed class LocalStore
{
    private static readonly JsonSerializerOptions Json = new()
    {
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public string Root { get; }
    public string SoundsDir { get; }
    public string AssignmentsPath { get; }

    public LocalStore(string? root = null)
    {
        Root = root ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "SoundConnect");

        SoundsDir = Path.Combine(Root, "sounds");
        AssignmentsPath = Path.Combine(Root, "assignments.json");

        Directory.CreateDirectory(SoundsDir);
    }

    public List<Assignment> LoadAssignments()
    {
        if (!File.Exists(AssignmentsPath)) return new List<Assignment>();

        try
        {
            var json = File.ReadAllText(AssignmentsPath);
            return JsonSerializer.Deserialize<List<Assignment>>(json, Json) ?? new List<Assignment>();
        }
        catch (Exception ex)
        {
            // A corrupt store must not take the companion down; it degrades to "no
            // assignments", which is a state the playback path already handles.
            Console.WriteLine($"  assignments.json unreadable ({ex.GetType().Name}) — treating as empty");
            return new List<Assignment>();
        }
    }

    public void SaveAssignments(List<Assignment> assignments)
        => File.WriteAllText(AssignmentsPath, JsonSerializer.Serialize(assignments, Json));

    public Assignment? ForDevice(string deviceId)
        => LoadAssignments().FirstOrDefault(
            a => string.Equals(a.DeviceId, deviceId, StringComparison.OrdinalIgnoreCase));

    public string SoundPath(Assignment assignment)
        => Path.Combine(SoundsDir, assignment.SoundFile);

    /// <summary>
    /// Copies an audio file into the store and assigns it, replacing any existing
    /// assignment for that device.
    /// </summary>
    public Assignment Assign(
        string deviceId, string deviceName, string sourceFile, int volume, int maxDurationMs,
        string? soundName = null)
    {
        var fileName = $"{Sanitize(deviceId)}{Path.GetExtension(sourceFile)}";
        File.Copy(sourceFile, Path.Combine(SoundsDir, fileName), overwrite: true);

        var all = LoadAssignments();
        all.RemoveAll(a => string.Equals(a.DeviceId, deviceId, StringComparison.OrdinalIgnoreCase));

        var assignment = new Assignment
        {
            DeviceId = deviceId,
            DeviceName = deviceName,
            SoundFile = fileName,
            SoundName = soundName ?? Path.GetFileName(sourceFile),
            Volume = volume,
            MaxDurationMs = Math.Clamp(maxDurationMs, 100, Assignment.MaxClipMs),
            AutoPlay = true
        };

        all.Add(assignment);
        SaveAssignments(all);
        return assignment;
    }

    private static string Sanitize(string value)
    {
        var chars = value.Select(c => char.IsLetterOrDigit(c) ? c : '_').ToArray();
        return new string(chars);
    }
}

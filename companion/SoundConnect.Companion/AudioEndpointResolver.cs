using Windows.Devices.Enumeration;
using Windows.Media.Devices;

namespace SoundConnect.Companion;

public sealed record AudioEndpoint(
    string Id,
    string Name,
    bool Enabled,
    DeviceInformation Info);

/// <summary>
/// Resolves the Windows audio render endpoint belonging to a connected Bluetooth device.
///
/// Backed by Core Audio: the ids returned here are MMDevice endpoint id strings, and are
/// treated as opaque per the spec — never parsed, only stored and compared.
///
/// Bluetooth connected does NOT imply the endpoint is ready. The two states are checked
/// separately, and the endpoint routinely appears a beat after the link comes up, which is
/// why resolution retries rather than answering once.
/// </summary>
public sealed class AudioEndpointResolver
{
    /// <summary>Words Windows appends to endpoint names that are not part of the device's name.</summary>
    private static readonly string[] EndpointNoise =
    {
        "stereo", "hands-free", "handsfree", "ag audio", "avrcp", "transport",
        "headset", "headphones", "speakers", "audio", "bluetooth", "wireless"
    };

    public async Task<IReadOnlyList<AudioEndpoint>> ListRenderEndpointsAsync()
    {
        var selector = MediaDevice.GetAudioRenderSelector();
        var found = await DeviceInformation.FindAllAsync(selector);

        var list = new List<AudioEndpoint>(found.Count);
        foreach (var di in found)
        {
            list.Add(new AudioEndpoint(di.Id, di.Name, di.IsEnabled, di));
        }
        return list;
    }

    /// <summary>
    /// Finds the render endpoint for a Bluetooth device, retrying while Windows brings it up.
    /// Returns null if no enabled endpoint appears within the budget — the caller must then
    /// report "connected, audio unavailable" rather than claiming success.
    /// </summary>
    public async Task<AudioEndpoint?> ResolveForDeviceAsync(
        string bluetoothDeviceName,
        TimeSpan budget,
        Action<string>? log = null)
    {
        var deadline = DateTimeOffset.Now + budget;
        int attempt = 0;

        while (DateTimeOffset.Now < deadline)
        {
            attempt++;
            var endpoints = await ListRenderEndpointsAsync();
            var match = Match(bluetoothDeviceName, endpoints);

            if (match is not null && match.Enabled)
            {
                log?.Invoke($"AUDIO_ENDPOINT_FOUND after {attempt} attempt(s): {match.Name}");
                return match;
            }

            if (match is not null)
            {
                log?.Invoke($"endpoint present but not enabled yet: {match.Name}");
            }

            // Bounded backoff: quick at first, easing off. A2DP endpoints commonly take
            // several hundred ms to a couple of seconds to become usable.
            await Task.Delay(Math.Min(250 * attempt, 1000));
        }

        log?.Invoke($"AUDIO_ENDPOINT_UNAVAILABLE for '{bluetoothDeviceName}' after {attempt} attempt(s)");
        return null;
    }

    /// <summary>
    /// Correlates a Bluetooth device name with an endpoint name. Windows exposes several
    /// endpoints per physical device — "Headphones (Airdopes 800 Stereo)", "Airdopes 800
    /// Hands-Free AG" — so both sides are reduced to comparable tokens before matching.
    /// Prefers a Stereo/A2DP endpoint over Hands-Free, which is mono and much lower quality.
    /// </summary>
    public AudioEndpoint? Match(string bluetoothDeviceName, IReadOnlyList<AudioEndpoint> endpoints)
    {
        var wanted = Normalize(bluetoothDeviceName);
        if (wanted.Length == 0) return null;

        AudioEndpoint? handsFree = null;

        foreach (var ep in endpoints)
        {
            if (!Normalize(ep.Name).Contains(wanted, StringComparison.Ordinal)) continue;

            bool isHandsFree = ep.Name.Contains("Hands-Free", StringComparison.OrdinalIgnoreCase)
                            || ep.Name.Contains("Headset", StringComparison.OrdinalIgnoreCase);

            if (isHandsFree) { handsFree ??= ep; continue; }
            return ep; // stereo / A2DP preferred
        }

        return handsFree;
    }

    /// <summary>Lowercases, strips endpoint noise words and non-alphanumerics.</summary>
    internal static string Normalize(string value)
    {
        var s = value.ToLowerInvariant();

        foreach (var noise in EndpointNoise)
        {
            s = s.Replace(noise, " ", StringComparison.Ordinal);
        }

        var chars = s.Where(char.IsLetterOrDigit).ToArray();
        return new string(chars);
    }
}

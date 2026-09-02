using Windows.Media.Core;
using Windows.Media.Playback;

namespace SoundConnect.Companion;

public enum PlaybackOutcome
{
    Started,
    FileMissing,
    Failed,
    NeverStarted
}

public readonly record struct PlaybackResult(
    PlaybackOutcome Outcome,
    TimeSpan? TimeToStart,
    string? Error);

/// <summary>
/// Native playback to a specific Windows audio endpoint.
///
/// Two rules the old implementation broke, both enforced here:
///   - PLAYBACK_STARTED is reported only after the player's own PlaybackSession
///     reports the Playing state. Calling Play() is a request, not evidence.
///   - Audio goes to the resolved endpoint, not the system default. Without
///     AudioDevice set, the sound comes out of the laptop speakers while the
///     earbuds sit silent — and the log would still claim success.
/// </summary>
public sealed class Player
{
    public async Task<PlaybackResult> PlayAsync(
        AudioEndpoint endpoint,
        string filePath,
        int volumePercent,
        int maxDurationMs,
        Action<string>? log = null)
    {
        if (!File.Exists(filePath))
        {
            return new PlaybackResult(PlaybackOutcome.FileMissing, null, filePath);
        }

        // Product ceiling. A clip may be shorter, never longer.
        maxDurationMs = Math.Clamp(maxDurationMs, 100, Assignment.MaxClipMs);
        double volume = Math.Clamp(volumePercent, 0, 100) / 100.0;

        var started = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var failed = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);

        using var player = new MediaPlayer
        {
            AudioDevice = endpoint.Info,
            Volume = volume,
            AutoPlay = false
        };

        player.MediaFailed += (_, e) =>
            failed.TrySetResult($"{e.Error}: {e.ErrorMessage}");

        player.PlaybackSession.PlaybackStateChanged += (session, _) =>
        {
            if (session.PlaybackState == MediaPlaybackState.Playing)
            {
                started.TrySetResult(true);
            }
        };

        var clock = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            player.Source = MediaSource.CreateFromUri(new Uri(Path.GetFullPath(filePath)));
            player.Play();
        }
        catch (Exception ex)
        {
            return new PlaybackResult(PlaybackOutcome.Failed, null, $"{ex.GetType().Name}: {ex.Message}");
        }

        // Wait for real playback, a failure, or a timeout — whichever lands first.
        var settled = await Task.WhenAny(
            started.Task,
            failed.Task,
            Task.Delay(3000));

        if (settled == failed.Task)
        {
            return new PlaybackResult(PlaybackOutcome.Failed, null, failed.Task.Result);
        }

        if (settled != started.Task)
        {
            return new PlaybackResult(PlaybackOutcome.NeverStarted, null, "no Playing state within 3s");
        }

        var timeToStart = clock.Elapsed;
        log?.Invoke($"PLAYBACK_STARTED  endpoint='{endpoint.Name}' volume={volumePercent}% cap={maxDurationMs}ms " +
                    $"(took {timeToStart.TotalMilliseconds:F0}ms to start)");

        await Task.Delay(maxDurationMs);

        player.Pause();
        log?.Invoke($"PLAYBACK_STOPPED  after {maxDurationMs}ms");

        return new PlaybackResult(PlaybackOutcome.Started, timeToStart, null);
    }
}

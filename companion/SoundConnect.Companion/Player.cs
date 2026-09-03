using Windows.Media.Core;
using Windows.Storage.Streams;
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
    private static string ContentTypeFor(string path) =>
        Path.GetExtension(path).ToLowerInvariant() switch
        {
            ".mp3" => "audio/mpeg",
            ".m4a" or ".aac" => "audio/aac",
            ".ogg" => "audio/ogg",
            ".flac" => "audio/flac",
            _ => "audio/wav"
        };

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

        MediaSource? source = null;
        try
        {
            // Played from memory, not from the file. CreateFromUri leaves MediaPlayer
            // holding the file open well past playback, so the next upload for that
            // device failed with "being used by another process". Reading the bytes up
            // front releases the file immediately; clips are capped at 10s, so the
            // memory cost is trivial.
            var bytes = await File.ReadAllBytesAsync(filePath);

            var buffer = new InMemoryRandomAccessStream();
            var writer = new DataWriter(buffer);
            writer.WriteBytes(bytes);
            await writer.StoreAsync();
            await writer.FlushAsync();
            writer.DetachStream();
            buffer.Seek(0);

            source = MediaSource.CreateFromStream(buffer, ContentTypeFor(filePath));
            player.Source = source;
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
        player.Source = null;
        source?.Dispose();
        log?.Invoke($"PLAYBACK_STOPPED  after {maxDurationMs}ms");

        return new PlaybackResult(PlaybackOutcome.Started, timeToStart, null);
    }
}

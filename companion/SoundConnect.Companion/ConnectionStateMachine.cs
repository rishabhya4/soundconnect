namespace SoundConnect.Companion;

/// <summary>What the state machine decided a status report means.</summary>
public enum TransitionKind
{
    /// <summary>Connected while already connected, or disconnected while already disconnected.</summary>
    Ignored,

    /// <summary>A genuine arrival. Carries a session id; this is the only kind that may play a sound.</summary>
    NewConnection,

    /// <summary>A genuine departure.</summary>
    Disconnected,

    /// <summary>
    /// Reconnected so quickly that the link almost certainly never really dropped.
    /// Observed on real hardware: Airdopes 800 returned 0.7s after disconnecting, twice.
    /// Treating this as an arrival would play the sound on every codec renegotiation.
    /// </summary>
    Flap
}

public readonly record struct Transition(
    TransitionKind Kind,
    string DeviceId,
    string? SessionId,
    TimeSpan? GapSinceDisconnect);

/// <summary>
/// Owns the four transitions from the spec, plus the flap gate that real hardware forces.
/// Deliberately has no dependency on WinRT, the clock, or anything else — every input is
/// passed in, so the whole thing is testable without a Bluetooth adapter.
/// </summary>
public sealed class ConnectionStateMachine
{
    private sealed class DeviceState
    {
        public bool Connected;
        public DateTimeOffset? DisconnectedAt;
        public DateTimeOffset? PlaybackEndedAt;
        public string? SessionId;
    }

    private readonly Dictionary<string, DeviceState> _states = new(StringComparer.OrdinalIgnoreCase);
    private readonly TimeSpan _settleThreshold;

    /// <summary>
    /// How long after our own playback a sub-second bounce is still attributed to the
    /// A2DP stream tearing down rather than to the user. Measured on real hardware: a
    /// 0.6s drop-and-return arrived 24s after a clip finished.
    /// </summary>
    private static readonly TimeSpan TeardownWindow = TimeSpan.FromSeconds(45);

    /// <summary>Gap below which a reconnect inside the teardown window is treated as our own doing.</summary>
    private static readonly TimeSpan TeardownGap = TimeSpan.FromSeconds(1);

    /// <param name="settleThreshold">
    /// Minimum time a device must stay disconnected for the following reconnect to count
    /// as a real arrival. Below this it is reported as a Flap and no session is created.
    /// </param>
    public ConnectionStateMachine(TimeSpan? settleThreshold = null)
    {
        // Deliberately low. Any disconnect-and-reconnect the user performs should play,
        // however quickly they do it. The nuisance case — a sub-second bounce caused by
        // our own audio stream tearing down — is handled by the teardown rule below
        // instead of by a blanket time gate, which used to swallow real reconnects.
        _settleThreshold = settleThreshold ?? TimeSpan.FromMilliseconds(250);
    }

    /// <summary>
    /// Feeds one observed connection status in. Returns what it means. Idempotent for
    /// repeated identical reports, which is what makes the poll-storm behaviour of the
    /// old implementation impossible here.
    /// </summary>
    public Transition Observe(string deviceId, bool connected, DateTimeOffset at)
    {
        if (!_states.TryGetValue(deviceId, out var state))
        {
            state = new DeviceState { Connected = false, DisconnectedAt = null };
            _states[deviceId] = state;
        }

        // CONNECTED -> CONNECTED, or DISCONNECTED -> DISCONNECTED.
        if (state.Connected == connected)
        {
            return new Transition(TransitionKind.Ignored, deviceId, state.SessionId, null);
        }

        if (!connected)
        {
            state.Connected = false;
            state.DisconnectedAt = at;
            state.SessionId = null;
            return new Transition(TransitionKind.Disconnected, deviceId, null, null);
        }

        // DISCONNECTED -> CONNECTED. Decide arrival vs flap.
        TimeSpan? gap = state.DisconnectedAt is { } since ? at - since : null;
        state.Connected = true;

        if (gap is { } g)
        {
            // A bounce we caused: the audio stream we just played tore down and the link
            // re-established itself. Suppressing only this narrow case means an ordinary
            // disconnect-and-reconnect by the user always plays, however fast they are.
            bool afterOwnPlayback =
                state.PlaybackEndedAt is { } ended &&
                at - ended < TeardownWindow &&
                g < TeardownGap;

            if (afterOwnPlayback || g < _settleThreshold)
            {
                // Do not mint a session. The device never meaningfully left.
                return new Transition(TransitionKind.Flap, deviceId, null, g);
            }
        }

        state.SessionId = NewSessionId(deviceId, at);
        return new Transition(TransitionKind.NewConnection, deviceId, state.SessionId, gap);
    }

    /// <summary>
    /// Session id per the spec: stable device identity plus the moment of connection.
    /// The device id is a Windows address-based identity, never a display name, so a
    /// rename in Windows settings cannot break it.
    /// </summary>
    private static string NewSessionId(string deviceId, DateTimeOffset at)
        => $"{deviceId}-{at.ToUnixTimeMilliseconds()}";

    /// <summary>
    /// Records that we finished playing on this device, so the link bounce our own
    /// stream provokes can be told apart from the user reconnecting.
    /// </summary>
    public void NotePlaybackEnded(string deviceId, DateTimeOffset at)
    {
        if (_states.TryGetValue(deviceId, out var s)) s.PlaybackEndedAt = at;
    }

    public bool IsConnected(string deviceId)
        => _states.TryGetValue(deviceId, out var s) && s.Connected;

    public string? CurrentSession(string deviceId)
        => _states.TryGetValue(deviceId, out var s) ? s.SessionId : null;
}

namespace SoundConnect.Companion;

/// <summary>
/// Deterministic proof of the Phase 02 exit criteria, with no Bluetooth adapter involved:
/// "Ten connect/disconnect cycles produce exactly ten sessions. Leaving a device connected
/// produces none." Hardware validation is a separate run; this catches logic regressions
/// without needing anyone to toggle an earbud.
/// </summary>
public static class SelfTest
{
    private const string Dev = "Bluetooth#Bluetoothf0:68:e3:5d:0b:5b-90:a0:be:7d:bf:f7";

    public static int Run()
    {
        int failures = 0;
        var t0 = DateTimeOffset.UnixEpoch;

        Console.WriteLine("ConnectionStateMachine self-test");
        Console.WriteLine(new string('-', 70));

        // --- 1. first arrival ------------------------------------------------
        var sm = new ConnectionStateMachine(TimeSpan.FromSeconds(3));
        failures += Check("first connect is an arrival",
            sm.Observe(Dev, true, t0).Kind, TransitionKind.NewConnection);

        // --- 2. connected -> connected is ignored ----------------------------
        failures += Check("repeat connect ignored",
            sm.Observe(Dev, true, t0.AddSeconds(1)).Kind, TransitionKind.Ignored);

        // --- 3. departure ----------------------------------------------------
        failures += Check("disconnect reported",
            sm.Observe(Dev, false, t0.AddSeconds(2)).Kind, TransitionKind.Disconnected);

        // --- 4. disconnected -> disconnected is ignored ----------------------
        failures += Check("repeat disconnect ignored",
            sm.Observe(Dev, false, t0.AddSeconds(3)).Kind, TransitionKind.Ignored);

        // --- 5. the real-hardware flap ---------------------------------------
        // Airdopes 800 measured at 0.7s. This must NOT create a session.
        var flap = sm.Observe(Dev, true, t0.AddSeconds(3.7));
        failures += Check("0.7s reconnect is a flap", flap.Kind, TransitionKind.Flap);
        failures += Check("flap mints no session", flap.SessionId is null, true);

        // --- 6. a genuine reconnect after settling ---------------------------
        sm.Observe(Dev, false, t0.AddSeconds(10));
        var real = sm.Observe(Dev, true, t0.AddSeconds(30));
        failures += Check("20s reconnect is an arrival", real.Kind, TransitionKind.NewConnection);
        failures += Check("arrival mints a session", real.SessionId is not null, true);

        // --- 7. ten cycles, ten sessions -------------------------------------
        var sm2 = new ConnectionStateMachine(TimeSpan.FromSeconds(3));
        var sessions = new HashSet<string>();
        var clock = t0;
        for (int i = 0; i < 10; i++)
        {
            clock = clock.AddSeconds(10);
            var on = sm2.Observe(Dev, true, clock);
            if (on.Kind == TransitionKind.NewConnection && on.SessionId is not null)
            {
                sessions.Add(on.SessionId);
            }
            clock = clock.AddSeconds(10);
            sm2.Observe(Dev, false, clock);
        }
        failures += Check("ten cycles produce ten distinct sessions", sessions.Count, 10);

        // --- 8. staying connected produces nothing ---------------------------
        var sm3 = new ConnectionStateMachine(TimeSpan.FromSeconds(3));
        sm3.Observe(Dev, true, t0);
        int extra = 0;
        for (int i = 1; i <= 100; i++)
        {
            if (sm3.Observe(Dev, true, t0.AddSeconds(i)).Kind == TransitionKind.NewConnection) extra++;
        }
        failures += Check("100 repeats while connected produce no new session", extra, 0);

        // --- 9. two devices do not interfere ---------------------------------
        const string other = "Bluetooth#Bluetoothf0:68:e3:5d:0b:5b-9c:de:f0:c9:14:24";
        var sm4 = new ConnectionStateMachine(TimeSpan.FromSeconds(3));
        var a = sm4.Observe(Dev, true, t0);
        var b = sm4.Observe(other, true, t0);
        failures += Check("second device gets its own session", a.SessionId != b.SessionId, true);
        failures += Check("first device still connected", sm4.IsConnected(Dev), true);

        // --- 10. a fast user toggle plays, with no recent playback -----------
        // The whole point of the low gate: the user reconnects quickly and expects sound.
        var sm5 = new ConnectionStateMachine();
        sm5.Observe(Dev, true, t0);
        sm5.Observe(Dev, false, t0.AddSeconds(10));
        failures += Check("0.6s toggle plays when no recent playback",
            sm5.Observe(Dev, true, t0.AddSeconds(10.6)).Kind, TransitionKind.NewConnection);

        // --- 11. the bounce our own audio stream causes is suppressed --------
        // Taken from the real log: clip finished, then a 0.6s drop-and-return 24s later.
        var sm6 = new ConnectionStateMachine();
        sm6.Observe(Dev, true, t0);
        sm6.NotePlaybackEnded(Dev, t0.AddSeconds(5));
        sm6.Observe(Dev, false, t0.AddSeconds(29));
        failures += Check("0.6s bounce 24s after our playback is suppressed",
            sm6.Observe(Dev, true, t0.AddSeconds(29.6)).Kind, TransitionKind.Flap);

        // --- 12. a real toggle after playback still plays --------------------
        // Suppression must be narrow: a proper disconnect is not a teardown bounce.
        var sm7 = new ConnectionStateMachine();
        sm7.Observe(Dev, true, t0);
        sm7.NotePlaybackEnded(Dev, t0.AddSeconds(5));
        sm7.Observe(Dev, false, t0.AddSeconds(20));
        failures += Check("2s toggle after playback still plays",
            sm7.Observe(Dev, true, t0.AddSeconds(22)).Kind, TransitionKind.NewConnection);

        // --- 13. long after playback, even a fast bounce plays ---------------
        var sm8 = new ConnectionStateMachine();
        sm8.Observe(Dev, true, t0);
        sm8.NotePlaybackEnded(Dev, t0.AddSeconds(5));
        sm8.Observe(Dev, false, t0.AddSeconds(120));
        failures += Check("0.6s bounce long after playback plays",
            sm8.Observe(Dev, true, t0.AddSeconds(120.6)).Kind, TransitionKind.NewConnection);

        Console.WriteLine(new string('-', 70));
        Console.WriteLine(failures == 0
            ? "ALL PASS"
            : $"{failures} FAILURE(S)");

        return failures == 0 ? 0 : 1;
    }

    private static int Check<T>(string label, T actual, T expected)
    {
        bool ok = EqualityComparer<T>.Default.Equals(actual, expected);
        Console.WriteLine($"  {(ok ? "pass" : "FAIL")}  {label}");
        if (!ok) Console.WriteLine($"          expected {expected}, got {actual}");
        return ok ? 0 : 1;
    }
}

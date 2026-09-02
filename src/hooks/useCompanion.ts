'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CompanionDevice,
  CompanionEvent,
  fetchDevices,
  fetchEvents,
  subscribe
} from '@/lib/companion-client';

export interface UseCompanion {
  devices: CompanionDevice[];
  events: CompanionEvent[];
  /** False when the companion is not reachable — the engine is not running. */
  online: boolean;
  /** True until the first successful read, so the UI can avoid flashing "offline". */
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Live view of the companion. Devices and events arrive by push, so the dashboard
 * reflects a connection the moment it happens — no refresh button, no polling loop,
 * and no browser Bluetooth involvement.
 */
export function useCompanion(): UseCompanion {
  const [devices, setDevices] = useState<CompanionDevice[]>([]);
  const [events, setEvents] = useState<CompanionEvent[]>([]);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const [d, e] = await Promise.all([fetchDevices(), fetchEvents()]);
      if (!mounted.current) return;
      setDevices(d);
      setEvents(e);
      setOnline(true);
    } catch {
      if (mounted.current) setOnline(false);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();

    const stream = subscribe({
      onDevices: (d) => mounted.current && setDevices(d),
      onEvent: (evt) =>
        mounted.current && setEvents((prev) => [evt, ...prev].slice(0, 200)),
      onStatus: (isOnline) => {
        if (!mounted.current) return;
        setOnline(isOnline);
        // Coming back from a drop, re-read rather than trusting stale state.
        if (isOnline) refresh();
      }
    });

    return () => {
      mounted.current = false;
      stream.close();
    };
  }, [refresh]);

  return { devices, events, online, loading, refresh };
}

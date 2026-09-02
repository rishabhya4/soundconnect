/**
 * Client for the Windows companion.
 *
 * The companion is the authority on devices, connection state, audio endpoints and
 * playback. The dashboard reads from it and posts configuration to it — it never
 * monitors Bluetooth itself, and closing the browser does not stop anything.
 */

export const COMPANION_URL = 'http://127.0.0.1:17385';

/** The four states from the spec, kept distinct. */
export type ConnectionState = 'Connected' | 'Paired' | 'Nearby' | 'Unavailable';

export interface CompanionDevice {
  /** Stable Windows device identity. Never a display name — survives a rename. */
  id: string;
  name: string;
  paired: boolean;
  connected: boolean;
  connectionState: ConnectionState;
  category: 'earbuds' | 'headphones' | 'speaker' | 'car' | 'phone' | 'computer' | 'other';

  /** Opaque MMDevice id, present only when an endpoint was genuinely resolved. */
  audioEndpointId?: string;
  audioEndpointName?: string;
  /** Bluetooth connected does NOT imply this. Reported separately, deliberately. */
  audioAvailable: boolean;

  soundFile?: string;
  soundName?: string;
  volume: number;
  maxDurationMs: number;
  autoPlay: boolean;

  lastConnectedAt?: number;
  lastDisconnectedAt?: number;
}

export interface CompanionEvent {
  type: string;
  deviceId?: string;
  deviceName?: string;
  message?: string;
  timestamp: string;
}

export interface CompanionHealth {
  status: string;
  startedAt: string;
  uptimeSeconds: number;
  store: string;
}

async function getJson<T>(path: string, timeoutMs = 3000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${COMPANION_URL}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`${path} returned ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function fetchHealth(): Promise<CompanionHealth> {
  return getJson<CompanionHealth>('/api/health');
}

export async function fetchDevices(): Promise<CompanionDevice[]> {
  const data = await getJson<{ devices: CompanionDevice[] }>('/api/devices');
  return data.devices ?? [];
}

export async function fetchEvents(): Promise<CompanionEvent[]> {
  const data = await getJson<{ events: CompanionEvent[] }>('/api/events');
  return data.events ?? [];
}

/** Uploads a trimmed clip and assigns it to a device, keyed by stable id. */
export async function uploadSound(
  deviceId: string,
  blob: Blob,
  volume: number,
  maxDurationMs: number,
  soundName?: string
): Promise<void> {
  const name = soundName ? `&name=${encodeURIComponent(soundName)}` : '';
  const query = `?volume=${volume}&maxDurationMs=${maxDurationMs}${name}`;
  const res = await fetch(
    `${COMPANION_URL}/api/sounds/${encodeURIComponent(deviceId)}${query}`,
    { method: 'POST', body: blob }
  );
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
  }
}

/** Updates volume, duration cap or autoPlay for a device that already has a sound. */
export async function updateAssignment(
  deviceId: string,
  changes: { volume?: number; maxDurationMs?: number; autoPlay?: boolean }
): Promise<void> {
  const res = await fetch(`${COMPANION_URL}/api/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, ...changes })
  });
  if (!res.ok) {
    throw new Error(`Update failed: ${res.status}`);
  }
}

export interface CompanionStream {
  close: () => void;
}

/**
 * Subscribes to live companion events. The dashboard updates as devices connect —
 * no refresh, no scan, no browser Bluetooth chooser.
 *
 * Reconnects on drop, which doubles as offline detection: onStatus(false) fires when
 * the companion goes away and onStatus(true) when it comes back.
 */
export function subscribe(handlers: {
  onDevices?: (devices: CompanionDevice[]) => void;
  onEvent?: (event: CompanionEvent) => void;
  onStatus?: (online: boolean) => void;
}): CompanionStream {
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let attempts = 0;

  // A page served over HTTPS cannot open ws:// to loopback — browsers treat it as
  // mixed content. Plain fetch to 127.0.0.1 is still permitted, so when the socket
  // cannot be established we fall back to polling. Slower to react, but the
  // dashboard keeps working instead of going dark on a deployed site.
  const startPolling = () => {
    if (closed || poll) return;

    const tick = async () => {
      try {
        const devices = await fetchDevices();
        if (closed) return;
        handlers.onDevices?.(devices);
        handlers.onStatus?.(true);
      } catch {
        if (!closed) handlers.onStatus?.(false);
      }
    };

    tick();
    poll = setInterval(tick, 3000);
  };

  const stopPolling = () => {
    if (poll) {
      clearInterval(poll);
      poll = null;
    }
  };

  const connect = () => {
    if (closed) return;

    try {
      socket = new WebSocket(`${COMPANION_URL.replace('http://', 'ws://')}/api/events`);
    } catch {
      scheduleRetry();
      return;
    }

    socket.onopen = () => {
      attempts = 0;
      stopPolling(); // the socket is live; polling is redundant
      handlers.onStatus?.(true);
    };

    socket.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data);
        if (payload.devices) handlers.onDevices?.(payload.devices);
        if (payload.event) handlers.onEvent?.(payload.event);
      } catch {
        // A malformed frame must not tear down the stream.
      }
    };

    socket.onclose = () => {
      handlers.onStatus?.(false);
      scheduleRetry();
    };

    socket.onerror = () => socket?.close();
  };

  const scheduleRetry = () => {
    if (closed || retry) return;

    // Back off rather than hammering every 2s. A companion that is simply not
    // running would otherwise fill the console with failed-connection noise for
    // as long as the tab stays open. Caps at 15s so recovery is still prompt.
    attempts += 1;
    const delay = Math.min(1000 * 2 ** Math.min(attempts, 4), 15000);

    // Two failures is enough to conclude the socket is not going to open here —
    // typically an HTTPS page that cannot reach ws://. Poll from then on, while
    // still retrying the socket in case the companion simply had not started.
    if (attempts >= 2) startPolling();

    retry = setTimeout(() => {
      retry = null;
      connect();
    }, delay);
  };

  connect();

  return {
    close: () => {
      closed = true;
      if (retry) clearTimeout(retry);
      stopPolling();
      socket?.close();
    }
  };
}

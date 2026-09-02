/**
 * Write-through sync: mirrors local IndexedDB writes to the server store.
 *
 * The dashboard stays local-first (IndexedDB is the source of truth for the UI),
 * but the Android and Windows companions read from the server's db.json. Without
 * this bridge nothing you pair in the browser is ever visible to them.
 *
 * Every call is best-effort: a failed sync logs and resolves, it never breaks the UI.
 */

import { DeviceRecord, SoundRecord, AssignmentRecord } from './indexed-db';

const CATEGORY_TO_TYPE: Record<string, string> = {
  earbuds: 'EARBUDS',
  headphones: 'HEADPHONES',
  speaker: 'SPEAKER',
  car: 'CAR',
  phone: 'OTHER',
  computer: 'OTHER',
  other: 'OTHER'
};

async function post(url: string, body: unknown): Promise<unknown> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.warn(`Sync to ${url} failed with ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`Sync to ${url} failed:`, err);
    return null;
  }
}

async function del(url: string): Promise<void> {
  try {
    await fetch(url, { method: 'DELETE' });
  } catch (err) {
    console.warn(`Sync delete ${url} failed:`, err);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function syncDevice(device: DeviceRecord): Promise<void> {
  await post('/api/devices', {
    id: device.id,
    deviceIdentifier: device.id,
    name: device.name,
    type: CATEGORY_TO_TYPE[device.category] || 'OTHER',
    connectionMode: device.connectionSource === 'android' ? 'ANDROID_COMPANION' : 'WEB_BLUETOOTH',
    enabled: device.autoPlay,
    soundId: device.soundId ?? null
  });
}

export async function syncDeleteDevice(id: string): Promise<void> {
  await del(`/api/devices/${id}`);
}

export async function syncSound(sound: SoundRecord): Promise<void> {
  const dataUrl = await blobToDataUrl(sound.blob);
  await post('/api/sounds', {
    id: sound.id,
    name: sound.name,
    dataUrl,
    duration: sound.durationMs / 1000,
    waveform: sound.waveform || []
  });
}

export async function syncDeleteSound(id: string): Promise<void> {
  await del(`/api/sounds?id=${encodeURIComponent(id)}`);
}

export async function syncAssignment(assignment: AssignmentRecord): Promise<void> {
  await post('/api/assignments', {
    deviceId: assignment.deviceId,
    soundId: assignment.soundId,
    volume: assignment.volume,
    maxDurationMs: assignment.maxDurationMs
  });
}

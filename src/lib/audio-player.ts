/**
 * Local Audio Player Engine for SoundConnect
 * Includes global Web Audio Context unlocker for bypassing browser Autoplay restrictions.
 */

import { SoundRecord } from './indexed-db';

let globalAudioCtx: AudioContext | null = null;
let isAudioUnlocked = false;

export function initAudioUnlocker(): void {
  if (typeof window === 'undefined') return;

  const unlocker = () => {
    try {
      if (!globalAudioCtx) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        globalAudioCtx = new AudioCtxClass();
      }
      if (globalAudioCtx.state === 'suspended') {
        globalAudioCtx.resume();
      }
      // Play brief silent buffer to unlock browser audio autoplay
      const buffer = globalAudioCtx.createBuffer(1, 1, 22050);
      const source = globalAudioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(globalAudioCtx.destination);
      source.start(0);

      isAudioUnlocked = true;
      console.log('🔊 Web Audio Autoplay Policy Unlocked successfully.');

      window.removeEventListener('click', unlocker);
      window.removeEventListener('keydown', unlocker);
      window.removeEventListener('touchstart', unlocker);
    } catch (e) {
      console.warn('Audio unlock warning:', e);
    }
  };

  window.addEventListener('click', unlocker, { once: true });
  window.addEventListener('keydown', unlocker, { once: true });
  window.addEventListener('touchstart', unlocker, { once: true });
}

export function isAudioEngineUnlocked(): boolean {
  return isAudioUnlocked || (globalAudioCtx !== null && globalAudioCtx.state === 'running');
}

export async function playSound(
  sound: SoundRecord,
  volume: number = 80,
  maxDurationMs: number = 10000,
  targetDeviceId?: string
): Promise<void> {
  if (!sound || !sound.blob) {
    console.warn('Cannot play sound: invalid SoundRecord or Blob missing.');
    return;
  }

  return new Promise((resolve) => {
    let objectUrl: string | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      objectUrl = URL.createObjectURL(sound.blob);
      const audio = new Audio(objectUrl);
      audio.volume = Math.max(0, Math.min(1, volume / 100));

      if (targetDeviceId && 'setSinkId' in audio && typeof (audio as any).setSinkId === 'function') {
        (audio as any).setSinkId(targetDeviceId).catch((err: any) => {
          console.warn('setSinkId output route warning:', err);
        });
      }

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        }
        resolve();
      };

      audio.onended = cleanup;
      audio.onerror = (e) => {
        console.warn('Audio playback error:', e);
        cleanup();
      };

      audio.play().then(() => {
        const effectiveMaxMs = Math.min(maxDurationMs || 10000, 10000);
        timeoutId = setTimeout(() => {
          audio.pause();
          audio.currentTime = 0;
          cleanup();
        }, effectiveMaxMs);
      }).catch((err) => {
        console.warn('Audio play request blocked or failed:', err);
        cleanup();
      });
    } catch (err) {
      console.warn('Playback exception:', err);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve();
    }
  });
}

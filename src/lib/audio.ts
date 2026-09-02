/**
 * Client-Side Audio Processing Engine for SoundConnect
 * Decodes, validates, visualizes waveforms, trims clips (max 10000ms / 10.0s), and creates local preview URLs.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export async function validateAudioFile(file: File): Promise<boolean> {
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('File size exceeds 15MB maximum limit.');
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const ctx = getAudioContext();
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    return decoded.duration > 0;
  } catch (err) {
    throw new Error('Audio file could not be decoded. Please upload a standard MP3, WAV, M4A, AAC, or OGG file.');
  }
}

export async function decodeAudio(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = getAudioContext();
  return await ctx.decodeAudioData(arrayBuffer.slice(0));
}

export function getAudioDuration(buffer: AudioBuffer): number {
  return buffer.duration;
}

export function createWaveform(buffer: AudioBuffer, samplesCount: number = 100): number[] {
  const channelData = buffer.getChannelData(0);
  const blockSize = Math.floor(channelData.length / samplesCount);
  const peaks: number[] = [];

  for (let i = 0; i < samplesCount; i++) {
    const start = i * blockSize;
    let max = 0;
    for (let j = 0; j < blockSize; j++) {
      const val = Math.abs(channelData[start + j] || 0);
      if (val > max) max = val;
    }
    peaks.push(max);
  }

  const maxPeak = Math.max(...peaks) || 1;
  return peaks.map(p => Math.max(0.05, p / maxPeak));
}

export function trimAudio(
  buffer: AudioBuffer,
  startTimeSec: number,
  endTimeSec: number
): AudioBuffer {
  const ctx = getAudioContext();
  // Enforce max 10000ms (10.0s) duration limit
  const durationSec = Math.min(Math.max(0.5, endTimeSec - startTimeSec), 10.0);
  const validStart = Math.max(0, startTimeSec);

  const sampleRate = buffer.sampleRate;
  const startSample = Math.floor(validStart * sampleRate);
  const frameCount = Math.floor(durationSec * sampleRate);

  const trimmedBuffer = ctx.createBuffer(
    buffer.numberOfChannels,
    frameCount,
    sampleRate
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    const trimmedData = trimmedBuffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      trimmedData[i] = channelData[startSample + i] || 0;
    }
  }

  return trimmedBuffer;
}

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const outBuffer = new DataView(new ArrayBuffer(length));
  const sampleRate = buffer.sampleRate;
  let offset = 0;

  const writeString = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      outBuffer.setUint8(offset++, str.charCodeAt(i));
    }
  };

  writeString('RIFF');
  outBuffer.setUint32(offset, length - 8, true); offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  outBuffer.setUint32(offset, 16, true); offset += 4;
  outBuffer.setUint16(offset, 1, true); offset += 2;
  outBuffer.setUint16(offset, numOfChan, true); offset += 2;
  outBuffer.setUint32(offset, sampleRate, true); offset += 4;
  outBuffer.setUint32(offset, sampleRate * 2 * numOfChan, true); offset += 4;
  outBuffer.setUint16(offset, numOfChan * 2, true); offset += 2;
  outBuffer.setUint16(offset, 16, true); offset += 2;
  writeString('data');
  outBuffer.setUint32(offset, length - offset - 4, true); offset += 4;

  const channels: Float32Array[] = [];
  for (let i = 0; i < numOfChan; i++) {
    channels.push(buffer.getChannelData(i));
  }

  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numOfChan; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      outBuffer.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([outBuffer], { type: 'audio/wav' });
}

export function createPreviewUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

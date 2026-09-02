/**
 * SoundConnect Audio Engine & Waveform Processing Library
 * Uses Web Audio API for decoding, waveform rendering, trimming (max 5.0s), and playback.
 */

export interface AudioTrimOptions {
  startTime: number; // in seconds
  endTime: number;   // in seconds (max start + 5.0s)
}

export class AudioEngine {
  private static audioCtx: AudioContext | null = null;

  static getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Decode an Audio File Buffer into an AudioBuffer
   */
  static async decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = this.getAudioContext();
    // Copy array buffer as decodeAudioData detaches the buffer
    const bufferCopy = arrayBuffer.slice(0);
    return await ctx.decodeAudioData(bufferCopy);
  }

  /**
   * Extract normalized waveform peaks array (e.g. 100 bars) for Canvas drawing
   */
  static extractPeaks(audioBuffer: AudioBuffer, samplesCount: number = 100): number[] {
    const channelData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(channelData.length / samplesCount);
    const peaks: number[] = [];

    for (let i = 0; i < samplesCount; i++) {
      const start = i * blockSize;
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const value = Math.abs(channelData[start + j] || 0);
        if (value > max) {
          max = value;
        }
      }
      peaks.push(max);
    }

    // Normalize peaks between 0.05 and 1.0 for aesthetic display
    const maxPeak = Math.max(...peaks) || 1;
    return peaks.map(p => Math.max(0.05, p / maxPeak));
  }

  /**
   * Trim an AudioBuffer to specified start and end times (max 5.0s duration)
   */
  static trimAudioBuffer(
    buffer: AudioBuffer,
    startTime: number,
    endTime: number
  ): AudioBuffer {
    const ctx = this.getAudioContext();
    const duration = Math.min(endTime - startTime, 5.0); // Strict 5 second cap
    const validStartTime = Math.max(0, startTime);
    
    const sampleRate = buffer.sampleRate;
    const startSample = Math.floor(validStartTime * sampleRate);
    const frameCount = Math.floor(duration * sampleRate);
    
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

  /**
   * Convert AudioBuffer into a WAV Blob Data URL
   */
  static audioBufferToWavBlob(buffer: AudioBuffer): Blob {
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

    /* RIFF identifier */
    writeString('RIFF');
    /* RIFF chunk length */
    outBuffer.setUint32(offset, length - 8, true); offset += 4;
    /* RIFF type */
    writeString('WAVE');
    /* format chunk identifier */
    writeString('fmt ');
    /* format chunk length */
    outBuffer.setUint32(offset, 16, true); offset += 4;
    /* sample format (raw PCM) */
    outBuffer.setUint16(offset, 1, true); offset += 2;
    /* channel count */
    outBuffer.setUint16(offset, numOfChan, true); offset += 2;
    /* sample rate */
    outBuffer.setUint32(offset, sampleRate, true); offset += 4;
    /* byte rate (sample rate * block align) */
    outBuffer.setUint32(offset, sampleRate * 2 * numOfChan, true); offset += 4;
    /* block align (channel count * bytes per sample) */
    outBuffer.setUint16(offset, numOfChan * 2, true); offset += 2;
    /* bits per sample */
    outBuffer.setUint16(offset, 16, true); offset += 2;
    /* data chunk identifier */
    writeString('data');
    /* data chunk length */
    outBuffer.setUint32(offset, length - offset - 4, true); offset += 4;

    // Write interleaved audio samples
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

  /**
   * Convert Blob to Data URL
   */
  static blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Play sound with volume (0 - 100) and optional max duration limit (ms)
   */
  static playSoundUrl(fileUrl: string, volume: number = 80, maxDurationMs: number = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const audio = new Audio(fileUrl);
        audio.volume = Math.max(0, Math.min(1, volume / 100));

        let timeoutId: NodeJS.Timeout;

        audio.onended = () => {
          if (timeoutId) clearTimeout(timeoutId);
          resolve();
        };

        audio.onerror = (e) => {
          if (timeoutId) clearTimeout(timeoutId);
          reject(e);
        };

        audio.play().then(() => {
          if (maxDurationMs > 0) {
            timeoutId = setTimeout(() => {
              audio.pause();
              audio.currentTime = 0;
              resolve();
            }, maxDurationMs);
          }
        }).catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  }
}

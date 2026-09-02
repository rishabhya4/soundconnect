'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Play, Square, Scissors, Check, Loader2, Music } from 'lucide-react';
import { validateAudioFile, decodeAudio, createWaveform, trimAudio, audioBufferToWavBlob, createPreviewUrl } from '@/lib/audio';
import { db, SoundRecord } from '@/lib/indexed-db';

interface AudioTrimmerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSoundSaved: (sound: SoundRecord) => void;
}

export function AudioTrimmerModal({ isOpen, onClose, onSoundSaved }: AudioTrimmerModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [soundName, setSoundName] = useState<string>('');
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(10.0);
  const [totalDuration, setTotalDuration] = useState<number>(0);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setAudioBuffer(null);
      setPeaks([]);
      setSoundName('');
      setErrorMsg(null);
      setIsPlaying(false);
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!canvasRef.current || peaks.length === 0 || totalDuration === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#0f172a');
    bgGradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    const startPct = startTime / totalDuration;
    const endPct = endTime / totalDuration;
    const barWidth = width / peaks.length;

    peaks.forEach((peak, i) => {
      const pct = i / peaks.length;
      const isSelected = pct >= startPct && pct <= endPct;
      const barHeight = Math.max(4, peak * (height - 20));

      const x = i * barWidth;
      const y = (height - barHeight) / 2;

      ctx.fillStyle = isSelected ? '#6366f1' : '#334155';
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });

    ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
    ctx.fillRect(startPct * width, 0, (endPct - startPct) * width, height);

    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(startPct * width, 0, (endPct - startPct) * width, height);
  }, [peaks, startTime, endTime, totalDuration]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      await validateAudioFile(selected);
      setFile(selected);
      setSoundName(selected.name.replace(/\.[^/.]+$/, ''));

      const decodedBuffer = await decodeAudio(selected);
      setAudioBuffer(decodedBuffer);

      const dur = decodedBuffer.duration;
      setTotalDuration(dur);

      const extractedPeaks = createWaveform(decodedBuffer, 120);
      setPeaks(extractedPeaks);

      setStartTime(0);
      setEndTime(Math.min(dur, 10.0)); // Cap default selection to 10.0s max
    } catch (err: any) {
      console.error('Audio decoding error:', err);
      setErrorMsg(err.message || 'Could not decode audio file.');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    if (!audioBuffer) return;
    setIsPlaying(true);
    try {
      const trimmed = trimAudio(audioBuffer, startTime, endTime);
      const blob = audioBufferToWavBlob(trimmed);
      const url = createPreviewUrl(blob);

      const audio = new Audio(url);
      activeAudioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };

      audio.play().catch(() => setIsPlaying(false));
    } catch (err) {
      console.error('Preview error:', err);
      setIsPlaying(false);
    }
  };

  const handleSaveSound = async () => {
    if (!audioBuffer || !soundName.trim()) return;
    setLoading(true);
    try {
      const trimmed = trimAudio(audioBuffer, startTime, endTime);
      const blob = audioBufferToWavBlob(trimmed);
      const clipDurationMs = Math.round(Math.min(endTime - startTime, 10.0) * 1000);

      const soundRecord: SoundRecord = {
        id: crypto.randomUUID(),
        name: soundName.trim() + '.wav',
        blob,
        mimeType: 'audio/wav',
        durationMs: clipDurationMs,
        waveform: peaks,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.saveSound(soundRecord);
      onSoundSaved(soundRecord);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error processing audio Blob.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentSelectionDuration = Math.max(0, endTime - startTime);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-xl rounded-2xl p-6 border border-slate-700/80 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl gradient-blue-purple flex items-center justify-center">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Upload & Trim Sound</h2>
            <p className="text-xs text-slate-400">Local-first IndexedDB Audio Trimmer (Max 10.0 seconds)</p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        {!audioBuffer ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-2xl p-8 text-center bg-slate-900/50 hover:bg-slate-900/90 transition-all cursor-pointer group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="audio/mp3,audio/wav,audio/m4a,audio/aac,audio/ogg"
              className="hidden"
            />
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <p className="text-sm font-medium text-slate-300">Decoding audio waveform...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Click to upload audio file</p>
                  <p className="text-xs text-slate-400 mt-1">Supports MP3, WAV, M4A, AAC, OGG (Max 15MB)</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Sound Title
              </label>
              <input
                type="text"
                value={soundName}
                onChange={(e) => setSoundName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-mono">
                <span className="flex items-center gap-1">
                  <Scissors className="w-3.5 h-3.5 text-indigo-400" /> Waveform Trimmer
                </span>
                <span>Selection: {currentSelectionDuration.toFixed(1)}s / 10.0s Max</span>
              </div>
              <div className="waveform-container flex items-center justify-center">
                <canvas ref={canvasRef} width={500} height={90} className="w-full h-full rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Start: <span className="text-indigo-400 font-mono">{startTime.toFixed(1)}s</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, totalDuration - 0.5)}
                  step={0.1}
                  value={startTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setStartTime(val);
                    if (endTime - val > 10.0) setEndTime(val + 10.0);
                    if (endTime <= val) setEndTime(Math.min(totalDuration, val + 0.5));
                  }}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  End: <span className="text-indigo-400 font-mono">{endTime.toFixed(1)}s</span>
                </label>
                <input
                  type="range"
                  min={startTime + 0.5}
                  max={Math.min(totalDuration, startTime + 10.0)}
                  step={0.1}
                  value={endTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setEndTime(val);
                  }}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handlePreview}
                disabled={isPlaying}
                className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isPlaying ? <Square className="w-4 h-4 text-indigo-400" /> : <Play className="w-4 h-4 text-indigo-400" />}
                <span>{isPlaying ? 'Playing...' : 'Preview Clip'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAudioBuffer(null)}
                  className="py-2.5 px-4 rounded-xl bg-slate-900 text-slate-400 hover:text-white text-xs font-medium transition-colors"
                >
                  Change File
                </button>
                <button
                  type="button"
                  onClick={handleSaveSound}
                  disabled={loading || !soundName.trim()}
                  className="flex items-center gap-2 py-2.5 px-5 rounded-xl gradient-blue-purple text-white font-semibold text-xs shadow-md hover:scale-[1.02] transition-transform cursor-pointer disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Sound</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

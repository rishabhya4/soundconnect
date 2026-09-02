'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Headphones, Bluetooth, Play, ArrowLeft, Volume2, Clock, Check, Loader2, ShieldCheck, Activity } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';
import { AudioEngine } from '@/lib/audio-engine';

export default function DeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [device, setDevice] = useState<any | null>(null);
  const [sounds, setSounds] = useState<any[]>([]);
  const [assignment, setAssignment] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Form controls
  const [selectedSoundId, setSelectedSoundId] = useState<string>('');
  const [autoPlay, setAutoPlay] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(80);
  const [maxDurationMs, setMaxDurationMs] = useState<number>(5000);
  const [previewing, setPreviewing] = useState<boolean>(false);

  useEffect(() => {
    const loadDetail = async () => {
      setLoading(true);
      try {
        const [devRes, sndRes, asgnRes] = await Promise.all([
          fetch(`/api/devices/${id}`),
          fetch('/api/sounds'),
          fetch('/api/assignments')
        ]);
        const devData = await devRes.json();
        const sndData = await sndRes.json();
        const asgnData = await asgnRes.json();

        if (devData.success) {
          setDevice(devData.device);
          setSelectedSoundId(devData.device.soundId || '');
          setAutoPlay(devData.device.enabled ?? true);
        }
        if (sndData.success) setSounds(sndData.sounds || []);

        if (asgnData.success && devData.device) {
          const match = asgnData.assignments.find((a: any) => a.deviceId === devData.device.id);
          if (match) {
            setAssignment(match);
            setVolume(match.volume ?? 80);
            setMaxDurationMs(match.maxDurationMs ?? 5000);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadDetail();
  }, [id]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    try {
      // 1. Update device
      await fetch(`/api/devices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soundId: selectedSoundId || null,
          enabled: autoPlay
        })
      });

      // 2. Update assignment
      if (selectedSoundId) {
        await fetch('/api/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: id,
            soundId: selectedSoundId,
            volume,
            maxDurationMs
          })
        });
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    const sound = sounds.find(s => s.id === selectedSoundId);
    if (!sound) return;

    setPreviewing(true);
    AudioEngine.playSoundUrl(sound.fileUrl, volume, maxDurationMs)
      .finally(() => setPreviewing(false));
  };

  const assignedSound = sounds.find(s => s.id === selectedSoundId);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!device) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-white p-8">
        <p>Device not found.</p>
        <Link href="/devices" className="text-indigo-400 underline mt-4 inline-block">
          ← Back to Devices
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex">
      <Sidebar />

      <div className="flex-1 md:pl-64 pb-20 md:pb-8 flex flex-col">
        <Navbar />

        <main className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto space-y-8">
          {/* Back button */}
          <Link
            href="/devices"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Devices</span>
          </Link>

          {/* Section 16 Requirement: Device Header */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl gradient-blue-purple flex items-center justify-center text-white shadow-xl">
                <Headphones className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
                  {device.name}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-400 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Connected
                  </span>
                </h1>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  ID: {device.deviceIdentifier} • Mode: {device.connectionMode}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Custom Sound Card */}
            <div className="lg:col-span-6 glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                🎵 Custom Connection Sound
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Select Assigned Audio Clip
                </label>
                <select
                  value={selectedSoundId}
                  onChange={(e) => setSelectedSoundId(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select a sound clip --</option>
                  {sounds.map((snd) => (
                    <option key={snd.id} value={snd.id}>
                      🎵 {snd.name} ({snd.duration}s)
                    </option>
                  ))}
                </select>
              </div>

              {assignedSound && (
                <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-indigo-200">{assignedSound.name}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Duration: {assignedSound.duration}s
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={previewing}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-blue-purple text-white text-xs font-semibold transition-transform hover:scale-105 cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>{previewing ? 'Playing...' : '▶ Play Test'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Playback Settings Card (Section 10 & 16 Requirement) */}
            <div className="lg:col-span-6 glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                ⚙️ Playback Rules & Volume
              </h3>

              {/* Auto Play toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div>
                  <h4 className="text-xs font-semibold text-white">Automatic Playback</h4>
                  <p className="text-[11px] text-slate-400">Play assigned sound on device connection</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoPlay}
                  onChange={(e) => setAutoPlay(e.target.checked)}
                  className="w-5 h-5 accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Volume Slider */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-indigo-400" /> Playback Volume
                  </span>
                  <span className="font-mono text-indigo-400">{volume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => setVolume(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Maximum Duration */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-400" /> Max Playback Duration
                  </span>
                  <span className="font-mono text-indigo-400">{(maxDurationMs / 1000).toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min={1000}
                  max={5000}
                  step={500}
                  value={maxDurationMs}
                  onChange={(e) => setMaxDurationMs(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Submit Save Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3.5 px-4 rounded-xl gradient-blue-purple text-white font-bold text-sm shadow-lg hover:scale-[1.01] transition-transform flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  <span>Save Configuration</span>
                </button>

                {savedSuccess && (
                  <p className="text-xs text-emerald-400 text-center font-semibold mt-2 animate-in fade-in">
                    ✓ Custom sound assigned successfully!
                  </p>
                )}
              </div>
            </div>
          </form>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}

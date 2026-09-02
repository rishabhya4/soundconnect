'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bluetooth, Headphones, Music2, Plus, Play, Activity, Sparkles, Upload, Volume2, ShieldCheck, VolumeX } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';
import { AddDeviceModal } from '@/components/AddDeviceModal';
import { AudioTrimmerModal } from '@/components/AudioTrimmerModal';
import { isBluetoothSupported, checkBluetoothAvailability } from '@/lib/bluetooth';
import { db, DeviceRecord, SoundRecord, AssignmentRecord } from '@/lib/indexed-db';
import { playSound, initAudioUnlocker, isAudioEngineUnlocked } from '@/lib/audio-player';

export default function DashboardPage() {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [sounds, setSounds] = useState<SoundRecord[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTrimmerOpen, setIsTrimmerOpen] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const [btSupported, setBtSupported] = useState(false);
  const [btAvailable, setBtAvailable] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const loadLocalData = async () => {
    setLoading(true);
    try {
      const [devList, sndList, asgnList] = await Promise.all([
        db.getDevices(),
        db.getSounds(),
        db.getAssignments()
      ]);
      setDevices(devList);
      setSounds(sndList);
      setAssignments(asgnList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocalData();
    initAudioUnlocker();

    const interval = setInterval(() => {
      setAudioUnlocked(isAudioEngineUnlocked());
    }, 1000);

    const checkBt = async () => {
      const supported = isBluetoothSupported();
      setBtSupported(supported);
      if (supported) {
        const avail = await checkBluetoothAvailability();
        setBtAvailable(avail);
      }
    };
    checkBt();

    return () => clearInterval(interval);
  }, []);

  const handlePlayActiveSound = async (soundId?: string) => {
    if (!soundId) return;
    const sound = sounds.find(s => s.id === soundId);
    if (!sound) return;

    setPreviewingId(sound.id);
    await playSound(sound, 85, 10000);
    setPreviewingId(null);
  };

  const connectedDevice = devices.find(d => d.autoPlay) || devices[0];
  const assignedSound = connectedDevice?.soundId
    ? sounds.find(s => s.id === connectedDevice.soundId)
    : null;

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex">
      <Sidebar />

      <div className="flex-1 md:pl-64 pb-20 md:pb-8 flex flex-col">
        <Navbar onOpenAddDevice={() => setIsAddModalOpen(true)} />

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto space-y-8">
          {/* Audio Autoplay Status Banner */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
            audioUnlocked
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-indigo-950/60 border-indigo-500/40 text-indigo-200'
          }`}>
            <div className="flex items-center gap-3 text-xs">
              {audioUnlocked ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <Volume2 className="w-5 h-5 text-indigo-400 animate-pulse shrink-0" />
              )}
              <div>
                <h4 className="font-bold">
                  {audioUnlocked ? '🔊 Browser Audio Autoplay Unlocked' : '⚡ Click Anywhere to Enable Audio Autoplay'}
                </h4>
                <p className="text-[11px] opacity-80">
                  {audioUnlocked
                    ? 'Your browser is ready to stream custom connection sounds through your earbuds.'
                    : 'Browsers require one mouse click anywhere on the page to allow automatic audio streaming.'}
                </p>
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                Bluetooth Dashboard
              </h1>
              <p className="text-xs md:text-sm text-slate-400 mt-1">
                Local-first IndexedDB Bluetooth sound application
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsTrimmerOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs md:text-sm font-semibold transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-indigo-400" />
                <span>+ Upload Sound</span>
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-blue-purple text-white text-xs md:text-sm font-semibold shadow-lg hover:scale-[1.02] transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Connect Bluetooth Device</span>
              </button>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Bluetooth Devices
                </p>
                <h3 className="text-2xl font-extrabold text-white mt-1">
                  {devices.length} Saved Devices
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {btAvailable ? '🟢 Bluetooth Active' : '🟡 Hardware Standby'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Bluetooth className="w-6 h-6" />
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Sounds
                </p>
                <h3 className="text-2xl font-extrabold text-white mt-1">
                  {sounds.length} Saved Sounds
                </h3>
                <p className="text-xs text-slate-400 mt-1">IndexedDB audio Blobs</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-950/80 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Music2 className="w-6 h-6" />
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Active Assignments
                </p>
                <h3 className="text-2xl font-extrabold text-white mt-1">
                  {assignments.length} Active Triggers
                </h3>
                <p className="text-xs text-emerald-400 mt-1 font-medium">Auto Play ON</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Activity className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Active Connected Device Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Bluetooth Device
              </span>
              {connectedDevice && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {connectedDevice.status || 'Connected'}
                </span>
              )}
            </div>

            {connectedDevice ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl gradient-blue-purple flex items-center justify-center shadow-lg text-white">
                    <Headphones className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{connectedDevice.name}</h2>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Category: {connectedDevice.category}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Assigned Connection Sound:</p>
                    <p className="text-sm font-bold text-indigo-300 mt-0.5 flex items-center gap-1.5">
                      🎵 {assignedSound ? assignedSound.name : 'No sound assigned yet'}
                    </p>
                  </div>

                  {assignedSound ? (
                    <button
                      onClick={() => handlePlayActiveSound(assignedSound.id)}
                      disabled={previewingId === assignedSound.id}
                      className="px-5 py-3 rounded-xl gradient-blue-purple text-white text-xs font-bold shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>{previewingId === assignedSound.id ? 'Playing Sound...' : '🎧 Play Connection Sound'}</span>
                    </button>
                  ) : (
                    <Link
                      href="/sounds"
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                    >
                      + Assign Sound
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 space-y-3">
                <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <Bluetooth className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">No Bluetooth devices yet</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    Connect a device and give it a custom connection sound.
                  </p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl gradient-blue-purple text-white text-xs font-bold shadow-md hover:scale-105 transition-transform cursor-pointer"
                >
                  Connect Device
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      <MobileNav />
      <AddDeviceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onDeviceAdded={loadLocalData}
      />
      <AudioTrimmerModal
        isOpen={isTrimmerOpen}
        onClose={() => setIsTrimmerOpen(false)}
        onSoundSaved={loadLocalData}
      />
    </div>
  );
}

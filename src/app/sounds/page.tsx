'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Music, Upload, Play, Trash2, Edit2, Headphones, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';
import { AudioTrimmerModal } from '@/components/AudioTrimmerModal';
import { db, SoundRecord } from '@/lib/indexed-db';
import { playSound } from '@/lib/audio-player';
import { useCompanion } from '@/hooks/useCompanion';
import { uploadSound } from '@/lib/companion-client';

export default function SoundsPage() {
  const [sounds, setSounds] = useState<SoundRecord[]>([]);
  // Devices come from the companion — they are real Windows Bluetooth devices,
  // not rows the browser invented.
  const { devices, online: companionOnline, refresh: refreshCompanion } = useCompanion();
  const [loading, setLoading] = useState<boolean>(true);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [isTrimmerOpen, setIsTrimmerOpen] = useState<boolean>(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const [assigningSound, setAssigningSound] = useState<SoundRecord | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [assigningLoading, setAssigningLoading] = useState<boolean>(false);

  const loadLocalData = async () => {
    setLoading(true);
    try {
      setSounds(await db.getSounds());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocalData();
  }, []);

  const handlePreview = async (sound: SoundRecord) => {
    setPreviewingId(sound.id);
    await playSound(sound, 85, 10000);
    setPreviewingId(null);
  };

  const handleDeleteSound = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sound clip?')) return;
    await db.deleteSound(id);
    setSounds(prev => prev.filter(s => s.id !== id));
  };

  const handleConfirmAssignment = async () => {
    if (!assigningSound || !selectedDeviceId) return;
    setAssigningLoading(true);
    setAssignError(null);
    try {
      // Upload the actual audio to the companion. Until this succeeds the sound is
      // only a file in the browser and nothing will ever play it.
      await uploadSound(
        selectedDeviceId,
        assigningSound.blob,
        80,
        Math.min(assigningSound.durationMs, 10000),
        assigningSound.name
      );
      setAssigningSound(null);
      setSelectedDeviceId('');
      await refreshCompanion();
    } catch (err: any) {
      setAssignError(
        companionOnline
          ? err?.message || 'Could not save the assignment.'
          : 'The SoundConnect companion is not running, so the sound cannot be armed.'
      );
    } finally {
      setAssigningLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex">
      <Sidebar />

      <div className="flex-1 md:pl-64 pb-20 md:pb-8 flex flex-col">
        <Navbar />

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                My Sounds
              </h1>
              <p className="text-xs md:text-sm text-slate-400 mt-1">
                Local sound library (max 10.0s clip length)
              </p>
            </div>

            <button
              onClick={() => setIsTrimmerOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-blue-purple text-white text-xs md:text-sm font-semibold shadow-lg hover:scale-[1.02] transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>+ Add Sound</span>
            </button>
          </div>

          {/* Sound Library Grid */}
          {sounds.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sounds.map((sound) => {
                const assignedDeviceNames = devices
                  .filter(d => d.soundName === sound.name)
                  .map(d => d.name);

                return (
                  <div
                    key={sound.id}
                    className="glass-panel glass-panel-hover p-6 rounded-2xl border border-slate-800 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-500/30 flex items-center justify-center text-purple-400">
                          <Music className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-900 text-indigo-300 font-semibold border border-slate-800">
                          {(sound.durationMs / 1000).toFixed(1)}s
                        </span>
                      </div>

                      <h3 className="font-bold text-base text-white">🎵 {sound.name}</h3>

                      {/* Assigned devices tag */}
                      <div className="mt-2 min-h-[32px]">
                        {assignedDeviceNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {assignedDeviceNames.map((devName, i) => (
                              <span
                                key={i}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-500/30"
                              >
                                🎧 {devName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500">Unassigned</span>
                        )}
                      </div>
                    </div>

                    {/* Actions (Section 23 Requirement: Preview, Edit, Assign, Delete) */}
                    <div className="grid grid-cols-4 gap-1.5 pt-4 border-t border-slate-800 mt-4 text-center">
                      <button
                        onClick={() => handlePreview(sound)}
                        disabled={previewingId === sound.id}
                        className="py-2 px-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>{previewingId === sound.id ? 'Playing' : 'Preview'}</span>
                      </button>

                      <Link
                        href={`/sounds/${sound.id}`}
                        className="py-2 px-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                      >
                        <Edit2 className="w-3 h-3 text-indigo-400" />
                        <span>Edit</span>
                      </Link>

                      <button
                        onClick={() => setAssigningSound(sound)}
                        className="py-2 px-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Headphones className="w-3 h-3 text-indigo-400" />
                        <span>Assign</span>
                      </button>

                      <button
                        onClick={() => handleDeleteSound(sound.id)}
                        className="py-2 px-1 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Section 24 Empty State */
            <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-4 max-w-xl mx-auto">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-purple-400">
                <Music className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">No sounds yet</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Upload a short sound to get started.
                </p>
              </div>
              <button
                onClick={() => setIsTrimmerOpen(true)}
                className="px-6 py-3 rounded-xl gradient-blue-purple text-white text-xs font-bold shadow-lg hover:scale-105 transition-transform cursor-pointer"
              >
                + Add Sound
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Assign Modal */}
      {assigningSound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">
              Assign 🎵 {assigningSound.name}
            </h3>
            <p className="text-xs text-slate-400">
              Select which Bluetooth device should play this sound upon connection.
            </p>

            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- Choose Bluetooth device --</option>
              {devices.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.connectionState}
                </option>
              ))}
            </select>

            {!companionOnline && (
              <p className="text-xs text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-xl px-3 py-2">
                Companion offline — start it before assigning, or nothing will play.
              </p>
            )}

            {companionOnline && devices.length === 0 && (
              <p className="text-xs text-slate-400">
                No Bluetooth devices paired in Windows yet.
              </p>
            )}

            {assignError && (
              <p className="text-xs text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-xl px-3 py-2">
                {assignError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setAssigningSound(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAssignment}
                disabled={assigningLoading || !selectedDeviceId}
                className="px-5 py-2 rounded-xl gradient-blue-purple text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {assigningLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileNav />
      <AudioTrimmerModal
        isOpen={isTrimmerOpen}
        onClose={() => setIsTrimmerOpen(false)}
        onSoundSaved={loadLocalData}
      />
    </div>
  );
}

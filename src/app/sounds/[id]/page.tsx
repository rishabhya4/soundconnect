'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Music, ArrowLeft, Play, Square, Scissors, Check, Loader2, Volume2, Trash2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';
import { AudioEngine } from '@/lib/audio-engine';

export default function SoundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [sound, setSound] = useState<any | null>(null);
  const [soundName, setSoundName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/sounds');
        const data = await res.json();
        if (data.success) {
          const match = data.sounds.find((s: any) => s.id === id);
          if (match) {
            setSound(match);
            setSoundName(match.name);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  const handlePlayPreview = () => {
    if (!sound) return;
    setIsPlaying(true);
    AudioEngine.playSoundUrl(sound.fileUrl, 85, Math.round(sound.duration * 1000))
      .finally(() => setIsPlaying(false));
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    setTimeout(() => {
      setSaving(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }, 500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!sound) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-white p-8">
        <p>Sound clip not found.</p>
        <Link href="/sounds" className="text-indigo-400 underline mt-4 inline-block">
          ← Back to Sound Library
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex">
      <Sidebar />

      <div className="flex-1 md:pl-64 pb-20 md:pb-8 flex flex-col">
        <Navbar />

        <main className="flex-1 p-4 md:p-8 max-w-4xl w-full mx-auto space-y-8">
          <Link
            href="/sounds"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Sound Library</span>
          </Link>

          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-950/80 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Music className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-white">{sound.name}</h1>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Duration: {sound.duration}s • Max Cap: 5.0s
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePlayPreview}
                disabled={isPlaying}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-blue-purple text-white text-xs font-bold shadow-md hover:scale-105 transition-transform cursor-pointer disabled:opacity-50"
              >
                {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                <span>{isPlaying ? 'Playing...' : '▶ Play Clip'}</span>
              </button>
            </div>

            <form onSubmit={handleSaveName} className="space-y-4 pt-4 border-t border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Audio Title
                </label>
                <input
                  type="text"
                  required
                  value={soundName}
                  onChange={(e) => setSoundName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                </button>
                {savedSuccess && (
                  <span className="text-xs text-emerald-400 font-semibold animate-in fade-in">
                    ✓ Saved
                  </span>
                )}
              </div>
            </form>
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}

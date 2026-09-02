'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Download, Upload, Trash2, Volume2, Clock, Check, Loader2, ShieldAlert } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';
import { db, SettingsRecord } from '@/lib/indexed-db';

export default function SettingsPage() {
  const [defaultVolume, setDefaultVolume] = useState<number>(80);
  const [maxDurationMs, setMaxDurationMs] = useState<number>(10000);
  const [autoPlayDefault, setAutoPlayDefault] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [clearing, setClearing] = useState<boolean>(false);

  useEffect(() => {
    const loadSettings = async () => {
      const sett = await db.getSettings();
      setDefaultVolume(sett.defaultVolume ?? 80);
      setMaxDurationMs(sett.maxDurationMs ?? 10000);
      setAutoPlayDefault(sett.autoPlayDefault ?? true);
    };
    loadSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const record: SettingsRecord = {
        defaultVolume,
        maxDurationMs,
        autoPlayDefault,
        updatedAt: Date.now()
      };
      await db.saveSettings(record);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      const [devices, sounds, assignments, settings] = await Promise.all([
        db.getDevices(),
        db.getSounds(),
        db.getAssignments(),
        db.getSettings()
      ]);

      const soundMeta = sounds.map(s => ({
        id: s.id,
        name: s.name,
        durationMs: s.durationMs,
        mimeType: s.mimeType,
        createdAt: s.createdAt
      }));

      const exportObject = {
        version: 1,
        exportedAt: new Date().toISOString(),
        devices,
        soundMetadata: soundMeta,
        assignments,
        settings
      };

      const jsonStr = JSON.stringify(exportObject, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soundconnect_backup_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleClearData = async () => {
    setClearing(true);
    try {
      await db.clearAllData();
      setShowClearConfirm(false);
      window.location.href = '/dashboard';
    } catch (err) {
      console.error(err);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex">
      <Sidebar />

      <div className="flex-1 md:pl-64 pb-20 md:pb-8 flex flex-col">
        <Navbar />

        <main className="flex-1 p-4 md:p-8 max-w-4xl w-full mx-auto space-y-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              Application Settings
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Local-first preferences, data export, and browser storage controls
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-8">
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                ⚙️ Global Playback Defaults
              </h3>

              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <div>
                  <h4 className="text-sm font-semibold text-white">Auto Play Default</h4>
                  <p className="text-xs text-slate-400">Enable automatic playback when adding new devices</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoPlayDefault}
                  onChange={(e) => setAutoPlayDefault(e.target.checked)}
                  className="w-5 h-5 accent-indigo-500 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4 text-indigo-400" /> Default Audio Volume
                    </span>
                    <span className="font-mono text-indigo-400">{defaultVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={defaultVolume}
                    onChange={(e) => setDefaultVolume(parseInt(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-400" /> Maximum Sound Duration
                    </span>
                    <span className="font-mono text-indigo-400">{(maxDurationMs / 1000).toFixed(1)}s</span>
                  </div>
                  <input
                    type="range"
                    min={1000}
                    max={10000}
                    step={500}
                    value={maxDurationMs}
                    onChange={(e) => setMaxDurationMs(parseInt(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl gradient-blue-purple text-white font-bold text-xs shadow-md transition-transform hover:scale-105 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Settings'}
                </button>
                {savedSuccess && (
                  <span className="text-xs text-emerald-400 font-semibold animate-in fade-in">
                    ✓ Settings saved
                  </span>
                )}
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                💾 Local Data Management
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={handleExportData}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-950 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Export My Data</h4>
                      <p className="text-[11px] text-slate-400">Download JSON backup of devices & assignments</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 hover:border-rose-500/60 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-950 text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-rose-300">Clear Local Data</h4>
                      <p className="text-[11px] text-rose-400/80">Remove devices, sounds & assignments from browser</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </form>

          {showClearConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
              <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-rose-500/40 shadow-2xl space-y-4">
                <div className="flex items-center gap-3 text-rose-400 font-bold text-base">
                  <ShieldAlert className="w-6 h-6" />
                  <span>Clear All Local Data?</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  This will permanently remove your saved devices, sounds, and assignments from this browser's IndexedDB storage.
                </p>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearData}
                    disabled={clearing}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Clear Everything'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <MobileNav />
    </div>
  );
}

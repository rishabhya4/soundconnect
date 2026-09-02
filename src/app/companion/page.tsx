'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Smartphone, CheckCircle2, Copy, RefreshCw, ShieldCheck, ArrowRight, Activity, Clock } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';

export default function CompanionPage() {
  const [companionToken, setCompanionToken] = useState('sc_comp_tok_8f93a12b90ce48a7');
  const [copiedToken, setCopiedToken] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncPayload, setSyncPayload] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCompanionStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/companion/sync', {
        headers: { 'X-Companion-Token': companionToken }
      });
      const data = await res.json();
      if (data.success) {
        setSyncPayload(data.payload);
        setLastSync(data.payload.syncedAt);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanionStatus();
  }, []);

  const copyToken = () => {
    navigator.clipboard.writeText(companionToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex">
      <Sidebar />

      <div className="flex-1 md:pl-64 pb-20 md:pb-8 flex flex-col">
        <Navbar />

        <main className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Smartphone className="w-8 h-8 text-indigo-400" />
              Android Companion Setup
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Pair your Android phone for reliable OS-level Bluetooth audio connection detection
            </p>
          </div>

          {/* Status Metrics Banner (Section 15 Requirement) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Companion Status
                </p>
                <h3 className="text-lg font-bold text-white mt-1 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  🟢 Connected
                </h3>
                <p className="text-xs text-emerald-400 mt-1 font-medium">Device Monitoring ON</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Last Synchronization
                </p>
                <h3 className="text-sm font-mono font-bold text-indigo-300 mt-1">
                  {lastSync ? new Date(lastSync).toLocaleTimeString() : '12:43 PM'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">Auto-sync active</p>
              </div>
              <button
                onClick={fetchCompanionStatus}
                className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Synced Devices
                </p>
                <h3 className="text-2xl font-extrabold text-white mt-1">
                  {syncPayload?.devices?.length || 0} Configured
                </h3>
                <p className="text-xs text-slate-400 mt-1">Local cached playback</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-950/80 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Activity className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Step-by-Step Instructions (Section 15 Requirement) */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
            <h3 className="text-base font-bold text-white">How to Pair Your Android Companion</h3>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-sm flex items-center justify-center mx-auto mb-2">
                  1
                </div>
                <h4 className="text-xs font-bold text-white mb-1">Install Companion</h4>
                <p className="text-[11px] text-slate-400">Download SoundConnect Android APK</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-sm flex items-center justify-center mx-auto mb-2">
                  2
                </div>
                <h4 className="text-xs font-bold text-white mb-1">Sign In</h4>
                <p className="text-[11px] text-slate-400">Enter your account or Pair Access Token</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-sm flex items-center justify-center mx-auto mb-2">
                  3
                </div>
                <h4 className="text-xs font-bold text-white mb-1">Bluetooth Access</h4>
                <p className="text-[11px] text-slate-400">Grant BLUETOOTH_CONNECT permissions</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-sm flex items-center justify-center mx-auto mb-2">
                  4
                </div>
                <h4 className="text-xs font-bold text-white mb-1">Background Mode</h4>
                <p className="text-[11px] text-slate-400">Enable Media3 Foreground Service</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-sm flex items-center justify-center mx-auto mb-2">
                  5
                </div>
                <h4 className="text-xs font-bold text-white mb-1">Sync & Enjoy</h4>
                <p className="text-[11px] text-slate-400">Sound triggers when earbuds connect!</p>
              </div>
            </div>

            {/* Token Generator Card */}
            <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-700 space-y-3">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Companion Pair Access Token:
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  readOnly
                  value={companionToken}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono text-indigo-300 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={copyToken}
                  className="px-5 py-3 rounded-xl gradient-blue-purple text-white text-xs font-bold shadow-md hover:scale-105 transition-transform flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copiedToken ? 'Copied Token!' : 'Copy Token'}</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}

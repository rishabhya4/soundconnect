'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Bluetooth, Headphones, Car, Volume2, Sparkles, ArrowRight, ShieldCheck, Play } from 'lucide-react';
import { AddDeviceModal } from '@/components/AddDeviceModal';
import { AudioEngine } from '@/lib/audio-engine';

export default function LandingPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 w-full glass-panel border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-blue-purple flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Bluetooth className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">SoundConnect</span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-white px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Open Dashboard →
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 pt-12 pb-24 flex flex-col items-center text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-8">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Direct Access • Custom Bluetooth Connection Sounds</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-4xl leading-tight mb-6">
          Your Bluetooth.{' '}
          <span className="gradient-text">Your Sound.</span>
        </h1>

        <p className="text-lg md:text-xl text-slate-300 max-w-2xl font-normal leading-relaxed mb-10">
          Give every Bluetooth device a custom sound. Personalize your audio experience when your earbuds, headphones, speakers, or car connect.
        </p>

        {/* Direct Action Buttons (No Login Needed) */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl gradient-blue-purple text-white font-bold text-base shadow-xl shadow-indigo-500/25 hover:scale-105 transition-transform flex items-center justify-center gap-3 cursor-pointer"
          >
            <Bluetooth className="w-5 h-5" />
            <span>Open Dashboard Direct</span>
          </Link>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl glass-panel border border-slate-700 hover:border-indigo-500/50 text-slate-200 font-semibold text-base transition-all hover:bg-slate-900/80 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>+ Connect Device</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Visual Flow Diagram */}
        <div className="w-full max-w-4xl glass-panel rounded-3xl p-8 border border-slate-800 bg-slate-950/50 shadow-2xl mb-20">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-6">
            How SoundConnect Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-lg mb-3">
                1
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Connect Device</h4>
              <p className="text-xs text-slate-400">Scan BLE/GATT in browser or pair via Android Companion</p>
            </div>

            <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold text-lg mb-3">
                2
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Upload Sound</h4>
              <p className="text-xs text-slate-400">Upload MP3/WAV & trim to max 5.0 seconds</p>
            </div>

            <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-400 flex items-center justify-center font-bold text-lg mb-3">
                3
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Assign</h4>
              <p className="text-xs text-slate-400">Pair sound to your device with custom volume</p>
            </div>

            <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-lg mb-3">
                4
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Enjoy</h4>
              <p className="text-xs text-slate-400">Hear your signature sound on every connection</p>
            </div>
          </div>
        </div>

        {/* Architecture Notice */}
        <div className="w-full max-w-3xl glass-panel p-6 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-slate-950 to-indigo-950/30 text-left flex items-start gap-4">
          <ShieldCheck className="w-6 h-6 text-indigo-400 shrink-0 mt-1" />
          <div>
            <h4 className="text-sm font-bold text-white mb-1">Direct Access • Zero Dummy Data</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              No registration or sign-in required. Use Web Bluetooth directly in your browser or pair with your Android Companion app for 100% background Bluetooth audio connection detection.
            </p>
          </div>
        </div>
      </main>

      {/* Add Device Modal */}
      <AddDeviceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onDeviceAdded={() => {
          window.location.href = '/dashboard';
        }}
      />
    </div>
  );
}

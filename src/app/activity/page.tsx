'use client';

import React, { useEffect, useState } from 'react';
import { Activity, Headphones, CheckCircle2, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';

export default function ActivityPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/playback-events');
      const data = await res.json();
      if (data.success) {
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex">
      <Sidebar />

      <div className="flex-1 md:pl-64 pb-20 md:pb-8 flex flex-col">
        <Navbar />

        <main className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                Connection Activity
              </h1>
              <p className="text-xs md:text-sm text-slate-400 mt-1">
                Real-time log of Bluetooth connection events and played sounds
              </p>
            </div>

            <button
              onClick={fetchEvents}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Refresh log"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Activity Table / List (Section 15 Requirement) */}
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
            <div className="divide-y divide-slate-800/80">
              {events.length > 0 ? (
                events.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-4 md:p-5 hover:bg-slate-900/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <Headphones className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white">{evt.deviceName || 'Bluetooth Device'}</h4>
                        <p className="text-xs text-indigo-300 font-mono mt-0.5">
                          🎵 {evt.soundName || 'Assigned Sound'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-left md:text-right text-xs">
                        <span className="text-slate-400 block font-mono">Source: {evt.source}</span>
                        <span className="text-slate-500 text-[11px] block mt-0.5">
                          {new Date(evt.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <div>
                        {evt.status === 'SUCCESS' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Played successfully
                          </span>
                        )}
                        {evt.status === 'SKIPPED' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-400 text-xs font-semibold">
                            <Clock className="w-3.5 h-3.5" /> Skipped
                          </span>
                        )}
                        {evt.status === 'FAILED' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-400 text-xs font-semibold">
                            <AlertCircle className="w-3.5 h-3.5" /> Failed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No connection events recorded yet.
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { HelpCircle, ShieldCheck, AlertTriangle, Smartphone, Radio, CheckCircle, Info } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';
import { isBluetoothSupported, checkBluetoothAvailability } from '@/lib/bluetooth';

export default function HelpPage() {
  const [btSupported, setBtSupported] = useState(false);
  const [btAvailable, setBtAvailable] = useState(false);

  useEffect(() => {
    const check = async () => {
      const supp = isBluetoothSupported();
      setBtSupported(supp);
      if (supp) {
        const avail = await checkBluetoothAvailability();
        setBtAvailable(avail);
      }
    };
    check();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex">
      <Sidebar />

      <div className="flex-1 md:pl-64 pb-20 md:pb-8 flex flex-col">
        <Navbar />

        <main className="flex-1 p-4 md:p-8 max-w-4xl w-full mx-auto space-y-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              Hardware & Browser Diagnostics
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Bluetooth capabilities and platform integration matrix
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-indigo-400" />
              Browser Diagnostics Result
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300 font-medium">Web Bluetooth API:</span>
                <span className={`font-bold px-2.5 py-1 rounded-full ${btSupported ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-rose-950 text-rose-300 border border-rose-500/30'}`}>
                  {btSupported ? 'Supported ✓' : 'Unsupported ✗'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300 font-medium">Bluetooth Radio Hardware:</span>
                <span className={`font-bold px-2.5 py-1 rounded-full ${btAvailable ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-amber-950 text-amber-300 border border-amber-500/30'}`}>
                  {btAvailable ? 'Radio Active ✓' : 'Standby / Check Radio'}
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}

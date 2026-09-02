'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bluetooth, Plus, ShieldCheck, AlertTriangle } from 'lucide-react';
import { isBluetoothSupported } from '@/lib/bluetooth';

interface NavbarProps {
  onOpenAddDevice?: () => void;
}

export function Navbar({ onOpenAddDevice }: NavbarProps) {
  const pathname = usePathname();
  const [btSupported, setBtSupported] = useState(false);

  useEffect(() => {
    setBtSupported(isBluetoothSupported());
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full glass-panel border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl gradient-blue-purple flex items-center justify-center text-white shadow-md">
            <Bluetooth className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white hidden sm:inline">
            SoundConnect
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-2 ml-4 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
          {btSupported ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Web Bluetooth Supported</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-400 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Limited Browser Bluetooth Support</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {onOpenAddDevice && (
          <button
            onClick={onOpenAddDevice}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl gradient-blue-purple text-white text-xs font-semibold shadow-md hover:scale-[1.02] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Connect Device</span>
          </button>
        )}
      </div>
    </header>
  );
}

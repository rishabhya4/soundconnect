'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Bluetooth, Music2, Activity, Settings, Smartphone, HelpCircle } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'My Devices', href: '/devices', icon: Bluetooth },
  { label: 'Sound Library', href: '/sounds', icon: Music2 },
  { label: 'Activity', href: '/activity', icon: Activity },
  { label: 'Android Companion', href: '/companion', icon: Smartphone },
  { label: 'Help & Diagnostics', href: '/help', icon: HelpCircle },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  if (pathname === '/' || pathname === '/login' || pathname === '/signup') return null;

  return (
    <aside className="hidden md:flex flex-col w-64 glass-panel border-r border-slate-800/80 min-h-screen p-4 fixed left-0 top-0 z-30">
      {/* Brand Header */}
      <Link href="/dashboard" className="flex items-center gap-3 px-3 py-4 mb-4 group">
        <div className="w-10 h-10 rounded-xl gradient-blue-purple flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
          <Bluetooth className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
            SoundConnect
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">Custom Bluetooth Sounds</p>
        </div>
      </Link>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'gradient-blue-purple text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Android Companion Banner */}
      <div className="mt-auto p-3.5 rounded-xl glass-panel border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 to-purple-950/30 text-left">
        <div className="flex items-center gap-2 text-indigo-400 text-[11px] font-semibold uppercase tracking-wider mb-1">
          <Smartphone className="w-3.5 h-3.5" /> Companion Sync
        </div>
        <p className="text-[11px] text-slate-300 mb-2 leading-relaxed">
          Pair Android phone for OS Bluetooth connection audio
        </p>
        <Link
          href="/companion"
          className="inline-block w-full text-center py-1.5 px-3 rounded-lg text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          Companion Setup →
        </Link>
      </div>
    </aside>
  );
}

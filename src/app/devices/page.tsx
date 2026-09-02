'use client';

import React from 'react';
import { Headphones, Volume2, Car, Smartphone, Monitor, Radio, AlertTriangle, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';
import { useCompanion } from '@/hooks/useCompanion';
import { CompanionDevice, COMPANION_URL, updateAssignment } from '@/lib/companion-client';

/**
 * Device list, rendered from the Windows companion's live state.
 *
 * Devices are not added here — they arrive from Windows. There is no pairing flow and
 * no browser Bluetooth chooser, because normal audio devices are Bluetooth Classic and
 * the browser cannot see them.
 */
export default function DevicesPage() {
  const { devices, online, loading, refresh } = useCompanion();

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex">
      <Sidebar />

      <div className="flex-1 md:pl-64 pb-20 md:pb-8 flex flex-col">
        <Navbar />

        <main className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto space-y-6">
          <header>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">My Bluetooth Devices</h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Live from Windows. Connect a device and this updates on its own.
            </p>
          </header>

          <CompanionStatus online={online} loading={loading} onRetry={refresh} />

          {online && devices.length === 0 && (
            <div className="glass-panel rounded-2xl border border-slate-800 p-10 text-center">
              <Radio className="w-8 h-8 text-slate-500 mx-auto mb-3" />
              <h3 className="font-bold">No paired Bluetooth devices</h3>
              <p className="text-sm text-slate-400 mt-1">
                Pair your earbuds in Windows Settings — they will appear here automatically.
              </p>
            </div>
          )}

          <div className="grid gap-3">
            {devices.map((device) => (
              <DeviceCard key={device.id} device={device} online={online} onChanged={refresh} />
            ))}
          </div>
        </main>

        <MobileNav />
      </div>
    </div>
  );
}

function CompanionStatus({
  online,
  loading,
  onRetry
}: {
  online: boolean;
  loading: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800">
        <Loader2 className="w-4 h-4 animate-spin" />
        Connecting to the SoundConnect companion…
      </div>
    );
  }

  if (online) {
    return (
      <div className="flex items-center gap-2 text-xs px-4 py-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="font-semibold">Companion connected</span>
        <span className="text-emerald-400/70">Bluetooth monitoring active</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200">
      <div className="flex items-center gap-2 text-xs font-semibold">
        <AlertTriangle className="w-4 h-4" />
        Companion offline
      </div>
      <p className="text-xs text-rose-300/80 mt-1.5 leading-relaxed">
        The Windows companion is not running, so nothing is watching for Bluetooth
        connections. Start it and this page will reconnect on its own.
      </p>
      <code className="block mt-2 text-[11px] bg-slate-950/60 rounded-lg px-2.5 py-1.5 text-slate-300">
        dotnet run --project companion/SoundConnect.Companion
      </code>
      <button
        onClick={onRetry}
        className="mt-2 text-[11px] font-semibold text-rose-200 underline underline-offset-2 cursor-pointer"
      >
        Retry now
      </button>
      <p className="text-[11px] text-rose-300/60 mt-2">Expected at {COMPANION_URL}</p>
    </div>
  );
}

function DeviceCard({
  device,
  online,
  onChanged
}: {
  device: CompanionDevice;
  online: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = React.useState(false);

  const toggleAutoPlay = async () => {
    setBusy(true);
    try {
      await updateAssignment(device.id, { autoPlay: !device.autoPlay });
      onChanged();
    } catch (err) {
      console.warn('Could not update autoPlay:', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`glass-panel rounded-2xl border border-slate-800 p-4 md:p-5 ${
        online ? '' : 'opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
            <CategoryIcon category={device.category} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold truncate">{device.name}</h3>
            <StatusLine device={device} online={online} />
          </div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Field label="Connection sound">
          {device.soundFile
            ? <span className="truncate block" title={device.soundName}>{device.soundName || 'Assigned'}</span>
            : <span className="text-slate-500">None yet</span>}
        </Field>
        <Field label="Volume">{device.volume}%</Field>
        <Field label="Stops after">{(device.maxDurationMs / 1000).toFixed(1)}s</Field>
        <Field label="Auto play">
          <button
            onClick={toggleAutoPlay}
            disabled={busy || !device.soundFile}
            className={`font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              device.autoPlay ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            {device.autoPlay ? 'ON' : 'OFF'}
          </button>
        </Field>
      </dl>

      {device.audioEndpointName && (
        <p className="mt-3 text-[11px] text-slate-500 truncate">
          Audio endpoint: {device.audioEndpointName}
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">{label}</dt>
      <dd className="font-semibold text-slate-200">{children}</dd>
    </div>
  );
}

/**
 * Connection and audio availability are separate facts. A device can be connected over
 * Bluetooth while Windows has no usable audio endpoint for it yet — that gets its own
 * amber state rather than being reported as ready.
 */
function StatusLine({ device, online }: { device: CompanionDevice; online: boolean }) {
  // With the companion down there is nothing watching Bluetooth, so the last state we
  // saw may be long stale. Say that, rather than keep asserting "Connected".
  if (!online) {
    return (
      <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
        Last known: {device.connectionState} · not being monitored
      </p>
    );
  }

  if (device.connectionState === 'Connected' && !device.audioAvailable) {
    return (
      <p className="text-xs text-amber-400 flex items-center gap-1.5 mt-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Connected · audio output unavailable
      </p>
    );
  }

  const map = {
    Connected: { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'Connected' },
    Paired: { dot: 'bg-slate-400', text: 'text-slate-400', label: 'Paired · not connected' },
    Nearby: { dot: 'bg-sky-400', text: 'text-sky-400', label: 'Nearby · not paired' },
    Unavailable: { dot: 'bg-rose-500', text: 'text-rose-400', label: 'Not available' }
  }[device.connectionState];

  return (
    <p className={`text-xs flex items-center gap-1.5 mt-0.5 ${map.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${map.dot}`} />
      {map.label}
    </p>
  );
}

function CategoryIcon({ category }: { category: string }) {
  const cls = 'w-5 h-5 text-indigo-400';
  switch (category) {
    case 'speaker': return <Volume2 className={cls} />;
    case 'car': return <Car className={cls} />;
    case 'phone': return <Smartphone className={cls} />;
    case 'computer': return <Monitor className={cls} />;
    default: return <Headphones className={cls} />;
  }
}

'use client';

import React, { useState, useEffect } from 'react';
import { X, Bluetooth, Smartphone, Headphones, Volume2, Car, Radio, Sparkles, ArrowRight, ShieldAlert, CheckCircle2, Loader2, Info } from 'lucide-react';
import { isBluetoothSupported, requestBluetoothDeviceWithBrand, getPreviouslyAuthorizedDevices, connectToDevice } from '@/lib/bluetooth';
import { db, DeviceRecord } from '@/lib/indexed-db';

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceAdded: (device: DeviceRecord) => void;
}

const BRAND_LIST = [
  { name: 'boAt (Airdopes)', prefix: 'boAt', altPrefix: 'Airdopes', icon: '🎧' },
  { name: 'realme Buds', prefix: 'realme', altPrefix: 'Realme', icon: '🎧' },
  { name: 'Apple AirPods', prefix: 'AirPods', altPrefix: 'AirPods', icon: '🎧' },
  { name: 'Boult Audio', prefix: 'Boult', altPrefix: 'BOULT', icon: '🎧' },
  { name: 'JBL Audio', prefix: 'JBL', altPrefix: 'JBL', icon: '🔊' },
  { name: 'Sony (WH / WF)', prefix: 'Sony', altPrefix: 'WH-', icon: '🎧' },
  { name: 'OnePlus / Nord', prefix: 'OnePlus', altPrefix: 'Nord', icon: '🎧' },
  { name: 'Nothing Ear', prefix: 'Nothing', altPrefix: 'Ear', icon: '🎧' },
];

export function AddDeviceModal({ isOpen, onClose, onDeviceAdded }: AddDeviceModalProps) {
  const [step, setStep] = useState<'type' | 'brand' | 'companion' | 'custom_name'>('type');
  const [selectedType, setSelectedType] = useState<string>('earbuds');
  const [selectedBrand, setSelectedBrand] = useState<any | null>(null);

  const [customName, setCustomName] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<'earbuds' | 'headphones' | 'speaker' | 'car' | 'other'>('earbuds');

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [btSupported, setBtSupported] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setStep('type');
      setSelectedType('earbuds');
      setSelectedBrand(null);
      setCustomName('');
      setErrorMsg(null);
      setLoading(false);
      setBtSupported(isBluetoothSupported());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle filtered brand request (eliminates "Unknown or Unsupported Device" MAC address lists)
  const handleScanBrandDevice = async (brandObj: any) => {
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Invoke Web Bluetooth using specific brand namePrefix filter
      const device = await requestBluetoothDeviceWithBrand(brandObj.prefix, brandObj.altPrefix);

      if (!device) {
        // The chooser closed without a device. Web Bluetooth only scans BLE (GATT)
        // advertisements, so Classic A2DP earbuds/speakers never appear here —
        // especially once they're already paired to the OS. Send the user to the
        // path that actually works instead of silently dropping them.
        setErrorMsg(
          `Chrome couldn't list ${brandObj.name}. Web Bluetooth only detects Bluetooth LE devices, and audio devices connect over Bluetooth Classic — add it by name below, then let the companion app detect the real connection.`
        );
        setCustomName('');
        setStep('custom_name');
        setLoading(false);
        return;
      }

      const realName = device.name || `${brandObj.name} Device`;

      const newRecord: DeviceRecord = {
        id: device.id || crypto.randomUUID(),
        name: realName,
        category: (selectedType as any) || 'earbuds',
        connectionSource: 'web',
        autoPlay: true,
        volume: 80,
        status: 'Connected',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.saveDevice(newRecord);
      onDeviceAdded(newRecord);
      onClose();
    } catch (err: any) {
      console.warn('Web Bluetooth error:', err);
      // Fallback: If Web Bluetooth cannot discover classic audio device, let user save clean name directly
      setErrorMsg(err?.message || 'Web Bluetooth scan failed. Add the device by name instead.');
      setCustomName('');
      setStep('custom_name');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustomDevice = async () => {
    if (!customName.trim()) return;
    setLoading(true);
    try {
      const newRecord: DeviceRecord = {
        id: crypto.randomUUID(),
        name: customName.trim(),
        category: customCategory,
        connectionSource: 'android',
        autoPlay: true,
        volume: 80,
        status: 'Connected',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.saveDevice(newRecord);
      onDeviceAdded(newRecord);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-slate-700/80 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl gradient-blue-purple flex items-center justify-center text-white shadow-md">
            <Bluetooth className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Connect Bluetooth Device
            </h2>
            <p className="text-xs text-slate-400">Select your audio device for custom sounds</p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        {/* STEP 1: Select Device Category */}
        {step === 'type' && (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              What type of device are you connecting?
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={() => {
                  setSelectedType('earbuds');
                  setStep('brand');
                }}
                className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 text-left flex items-center justify-between transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center">
                    <Headphones className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">🎧 Earbuds / Headphones</h4>
                    <p className="text-[11px] text-slate-400">Airdopes, AirPods, realme Buds, Boult, Sony</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
              </button>

              <button
                onClick={() => {
                  setSelectedType('speaker');
                  setStep('brand');
                }}
                className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 text-left flex items-center justify-between transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-950 text-purple-400 flex items-center justify-center">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">🔊 Bluetooth Speaker</h4>
                    <p className="text-[11px] text-slate-400">JBL Flip, Sony, Bose, Marshall</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
              </button>

              <button
                onClick={() => {
                  setSelectedType('car');
                  setStep('brand');
                }}
                className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 text-left flex items-center justify-between transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-pink-950 text-pink-400 flex items-center justify-center">
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">🚗 Car Audio System</h4>
                    <p className="text-[11px] text-slate-400">Car Bluetooth infotainment system</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-pink-400 transition-colors" />
              </button>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <button
                onClick={() => setStep('companion')}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
              >
                <Smartphone className="w-4 h-4" />
                <span>📱 Use Android Companion</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Brand-Filtered Selector (Eliminates Unknown MAC Address Chooser Lists) */}
        {step === 'brand' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Select your brand filter:
              </p>
              <button
                onClick={() => setStep('type')}
                className="text-xs text-slate-400 hover:text-white"
              >
                ← Back
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200/90 text-[11px] leading-relaxed flex gap-2">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Browser scanning only finds <strong>Bluetooth LE</strong> devices. Most earbuds,
                headphones and speakers use Bluetooth Classic and won&apos;t appear here — add them by
                name and the companion app will detect the real connection.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {BRAND_LIST.map((b, i) => (
                <button
                  key={i}
                  onClick={() => handleScanBrandDevice(b)}
                  disabled={loading}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 text-left transition-all hover:bg-slate-800/80 cursor-pointer"
                >
                  <div className="text-base mb-1">{b.icon}</div>
                  <div className="text-xs font-bold text-white">{b.name}</div>
                  <div className="text-[10px] text-slate-400">Filter: {b.prefix}</div>
                </button>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Don't see your brand?</span>
              <button
                onClick={() => {
                  setCustomName('');
                  setStep('custom_name');
                }}
                className="text-indigo-400 hover:text-indigo-300 font-bold underline"
              >
                Enter Name Directly →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Clean Name Input (For Airdopes 800, Airdopes Alpha, realme Buds Air7, etc.) */}
        {step === 'custom_name' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Add Bluetooth Audio Device</h3>
              <button
                onClick={() => setStep('brand')}
                className="text-xs text-slate-400 hover:text-white"
              >
                ← Back
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                Device Name (e.g. Airdopes 800, realme Buds Air7)
              </label>
              <input
                type="text"
                placeholder="e.g. Airdopes 800"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                Category
              </label>
              <select
                value={customCategory}
                onChange={(e: any) => setCustomCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="earbuds">Earbuds</option>
                <option value="headphones">Headphones</option>
                <option value="speaker">Speaker</option>
                <option value="car">Car Audio</option>
                <option value="other">Other</option>
              </select>
            </div>

            <button
              onClick={handleSaveCustomDevice}
              disabled={!customName.trim() || loading}
              className="w-full py-3 rounded-xl gradient-blue-purple text-white font-bold text-xs shadow-md hover:scale-[1.01] transition-transform cursor-pointer disabled:opacity-50"
            >
              Save Device Profile
            </button>
          </div>
        )}

        {/* STEP 4: Android Companion Explanation */}
        {step === 'companion' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                <Smartphone className="w-5 h-5" />
                <span>Android Companion Setup</span>
              </div>
              <button
                onClick={() => setStep('type')}
                className="text-xs text-slate-400 hover:text-white"
              >
                ← Back
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
              The Android Companion app detects OS-level Bluetooth audio connections (Airdopes 800, realme Buds Air7, AirPods, Boult, JBL) and triggers your custom sound automatically through your connected earbuds.
            </p>

            <button
              onClick={() => {
                setCustomName('Airdopes 800');
                setStep('custom_name');
              }}
              className="w-full py-3 rounded-xl bg-indigo-950 border border-indigo-500/30 text-indigo-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              + Add Device Profile Manually (e.g. Airdopes 800)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

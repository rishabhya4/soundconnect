/**
 * Client-Side Local State Manager & IndexedDB Persistence
 * Caches devices, sounds, assignments, and settings offline for immediate UI feedback.
 */

import { BluetoothDeviceEntity, SoundEntity, DeviceSoundAssignmentEntity, PlaybackEventEntity, SettingsEntity } from './store';

const STORAGE_KEYS = {
  DEVICES: 'soundconnect_devices',
  SOUNDS: 'soundconnect_sounds',
  ASSIGNMENTS: 'soundconnect_assignments',
  EVENTS: 'soundconnect_events',
  SETTINGS: 'soundconnect_settings'
};

export class ClientDB {
  static getDevices(): BluetoothDeviceEntity[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.DEVICES);
    return data ? JSON.parse(data) : [];
  }

  static saveDevices(devices: BluetoothDeviceEntity[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.DEVICES, JSON.stringify(devices));
  }

  static getSounds(): SoundEntity[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.SOUNDS);
    return data ? JSON.parse(data) : [];
  }

  static saveSounds(sounds: SoundEntity[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.SOUNDS, JSON.stringify(sounds));
  }

  static getAssignments(): DeviceSoundAssignmentEntity[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS);
    return data ? JSON.parse(data) : [];
  }

  static saveAssignments(assignments: DeviceSoundAssignmentEntity[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));
  }

  static getEvents(): PlaybackEventEntity[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.EVENTS);
    return data ? JSON.parse(data) : [];
  }

  static saveEvents(events: PlaybackEventEntity[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
  }
}

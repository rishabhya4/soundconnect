/**
 * Local-First IndexedDB Persistence Store for SoundConnect
 * Database: SoundConnectDB (v1)
 * Stores: devices, sounds, assignments, settings
 */

export interface DeviceRecord {
  id: string; // Bluetooth device identifier or generated UUID
  name: string;
  category: 'earbuds' | 'headphones' | 'speaker' | 'car' | 'phone' | 'computer' | 'other';
  connectionSource: 'web' | 'android';
  soundId?: string;
  autoPlay: boolean;
  volume: number; // 0 to 100
  status?: 'Connected' | 'Available' | 'Not connected' | 'Unsupported';
  createdAt: number;
  updatedAt: number;
}

export interface SoundRecord {
  id: string;
  name: string;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  waveform?: number[];
  createdAt: number;
  updatedAt: number;
}

export interface AssignmentRecord {
  id: string;
  deviceId: string;
  soundId: string;
  volume: number;
  maxDurationMs: number;
  autoPlay: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SettingsRecord {
  defaultVolume: number;
  maxDurationMs: number;
  autoPlayDefault: boolean;
  updatedAt: number;
}

const DB_NAME = 'SoundConnectDB';
const DB_VERSION = 1;

class SoundConnectIDB {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        reject(new Error('IndexedDB is not supported in this environment.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('devices')) {
          db.createObjectStore('devices', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sounds')) {
          db.createObjectStore('sounds', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('assignments')) {
          db.createObjectStore('assignments', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // --- Devices ---
  async getDevices(): Promise<DeviceRecord[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('devices', 'readonly');
      const store = tx.objectStore('devices');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async saveDevice(device: DeviceRecord): Promise<DeviceRecord> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('devices', 'readwrite');
      const store = tx.objectStore('devices');
      const req = store.put(device);
      req.onsuccess = () => resolve(device);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteDevice(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['devices', 'assignments'], 'readwrite');
      tx.objectStore('devices').delete(id);

      const asgnStore = tx.objectStore('assignments');
      const req = asgnStore.getAll();
      req.onsuccess = () => {
        const assignments: AssignmentRecord[] = req.result || [];
        assignments.forEach(a => {
          if (a.deviceId === id) asgnStore.delete(a.id);
        });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Sounds ---
  async getSounds(): Promise<SoundRecord[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sounds', 'readonly');
      const store = tx.objectStore('sounds');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async saveSound(sound: SoundRecord): Promise<SoundRecord> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sounds', 'readwrite');
      const store = tx.objectStore('sounds');
      const req = store.put(sound);
      req.onsuccess = () => resolve(sound);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteSound(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['sounds', 'devices', 'assignments'], 'readwrite');
      tx.objectStore('sounds').delete(id);

      const devStore = tx.objectStore('devices');
      const devReq = devStore.getAll();
      devReq.onsuccess = () => {
        const devices: DeviceRecord[] = devReq.result || [];
        devices.forEach(d => {
          if (d.soundId === id) {
            d.soundId = undefined;
            devStore.put(d);
          }
        });
      };

      const asgnStore = tx.objectStore('assignments');
      const asgnReq = asgnStore.getAll();
      asgnReq.onsuccess = () => {
        const assignments: AssignmentRecord[] = asgnReq.result || [];
        assignments.forEach(a => {
          if (a.soundId === id) asgnStore.delete(a.id);
        });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Assignments ---
  async getAssignments(): Promise<AssignmentRecord[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assignments', 'readonly');
      const store = tx.objectStore('assignments');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async saveAssignment(assignment: AssignmentRecord): Promise<AssignmentRecord> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['assignments', 'devices'], 'readwrite');
      tx.objectStore('assignments').put(assignment);

      const devStore = tx.objectStore('devices');
      const getDev = devStore.get(assignment.deviceId);
      getDev.onsuccess = () => {
        const dev: DeviceRecord = getDev.result;
        if (dev) {
          dev.soundId = assignment.soundId;
          dev.volume = assignment.volume;
          dev.autoPlay = assignment.autoPlay;
          dev.updatedAt = Date.now();
          devStore.put(dev);
        }
      };

      tx.oncomplete = () => resolve(assignment);
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Settings ---
  async getSettings(): Promise<SettingsRecord> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get('global_settings');
      req.onsuccess = () => {
        resolve(req.result || {
          defaultVolume: 80,
          maxDurationMs: 10000,
          autoPlayDefault: true,
          updatedAt: Date.now()
        });
      };
      req.onerror = () => {
        resolve({
          defaultVolume: 80,
          maxDurationMs: 10000,
          autoPlayDefault: true,
          updatedAt: Date.now()
        });
      };
    });
  }

  async saveSettings(settings: SettingsRecord): Promise<SettingsRecord> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const req = store.put({ id: 'global_settings', ...settings });
      req.onsuccess = () => resolve(settings);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Clear Database ---
  async clearAllData(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['devices', 'sounds', 'assignments', 'settings'], 'readwrite');
      tx.objectStore('devices').clear();
      tx.objectStore('sounds').clear();
      tx.objectStore('assignments').clear();
      tx.objectStore('settings').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const db = new SoundConnectIDB();

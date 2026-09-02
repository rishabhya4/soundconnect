import fs from 'fs';
import path from 'path';

export interface UserEntity {
  id: string;
  email: string;
  companionToken: string;
  createdAt: string;
}

export interface BluetoothDeviceEntity {
  id: string;
  userId: string;
  deviceIdentifier: string;
  name: string;
  type: 'EARBUDS' | 'HEADPHONES' | 'CAR' | 'SPEAKER' | 'OTHER';
  connectionMode: 'WEB_BLUETOOTH' | 'ANDROID_COMPANION';
  enabled: boolean;
  soundId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SoundEntity {
  id: string;
  userId: string;
  name: string;
  fileUrl: string;
  duration: number; // in seconds
  waveform?: number[];
  createdAt: string;
  updatedAt: string;
}

export interface DeviceSoundAssignmentEntity {
  id: string;
  deviceId: string;
  soundId: string;
  enabled: boolean;
  volume: number; // 0 to 100
  maxDurationMs: number; // default 5000
  createdAt: string;
  updatedAt: string;
}

export interface PlaybackEventEntity {
  id: string;
  deviceId: string;
  deviceName?: string;
  soundId?: string | null;
  soundName?: string;
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED';
  source: 'WEB_BLUETOOTH' | 'ANDROID_COMPANION' | 'WINDOWS_COMPANION' | 'TEST_PREVIEW';
  timestamp: string;
  errorMessage?: string;
}

export interface SettingsEntity {
  id: string;
  userId: string;
  autoPlay: boolean;
  defaultVolume: number;
  maxDurationMs: number;
  androidSyncEnabled: boolean;
  updatedAt: string;
}

interface DatabaseSchema {
  users: UserEntity[];
  devices: BluetoothDeviceEntity[];
  sounds: SoundEntity[];
  assignments: DeviceSoundAssignmentEntity[];
  playbackEvents: PlaybackEventEntity[];
  settings: SettingsEntity[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Completely clean empty initial database (zero dummy data)
const INITIAL_DATA: DatabaseSchema = {
  users: [
    {
      id: 'usr_default_101',
      email: 'user@soundconnect.app',
      companionToken: 'sc_comp_tok_8f93a12b90ce48a7',
      createdAt: new Date().toISOString()
    }
  ],
  devices: [],
  sounds: [],
  assignments: [],
  playbackEvents: [],
  settings: [
    {
      id: 'sett_usr_default',
      userId: 'usr_default_101',
      autoPlay: true,
      defaultVolume: 80,
      maxDurationMs: 5000,
      androidSyncEnabled: true,
      updatedAt: new Date().toISOString()
    }
  ]
};

function ensureDataFile(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DATA, null, 2), 'utf-8');
      return INITIAL_DATA;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;

    // Backfill collections missing from an older or partially-written db.json.
    // Without this, one absent key (`users`) takes down every companion endpoint.
    const merged: DatabaseSchema = {
      users: parsed.users?.length ? parsed.users : INITIAL_DATA.users,
      devices: parsed.devices ?? [],
      sounds: parsed.sounds ?? [],
      assignments: parsed.assignments ?? [],
      playbackEvents: parsed.playbackEvents ?? [],
      settings: parsed.settings?.length ? parsed.settings : INITIAL_DATA.settings
    };

    if (!parsed.users?.length || !parsed.settings?.length) {
      saveDataFile(merged);
    }
    return merged;
  } catch (err) {
    console.error('Failed to read database file, falling back to initial data:', err);
    return INITIAL_DATA;
  }
}

function saveDataFile(data: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write database file:', err);
  }
}

export const dbStore = {
  getData(): DatabaseSchema {
    return ensureDataFile();
  },

  getDevices(): BluetoothDeviceEntity[] {
    return this.getData().devices;
  },

  getDeviceById(id: string): BluetoothDeviceEntity | undefined {
    return this.getDevices().find(d => d.id === id);
  },

  addDevice(
    device: Omit<BluetoothDeviceEntity, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): BluetoothDeviceEntity {
    const db = this.getData();
    // The browser supplies its IndexedDB id so both stores agree on device identity.
    const existing = db.devices.find(
      d => (device.id && d.id === device.id) || d.deviceIdentifier === device.deviceIdentifier
    );
    if (existing) {
      existing.name = device.name;
      existing.type = device.type;
      existing.connectionMode = device.connectionMode;
      existing.enabled = device.enabled;
      if (device.soundId !== undefined) existing.soundId = device.soundId;
      existing.updatedAt = new Date().toISOString();
      saveDataFile(db);
      return existing;
    }

    const newDevice: BluetoothDeviceEntity = {
      ...device,
      id: device.id || 'dev_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.devices.unshift(newDevice);
    saveDataFile(db);
    return newDevice;
  },

  updateDevice(id: string, updates: Partial<BluetoothDeviceEntity>): BluetoothDeviceEntity | null {
    const db = this.getData();
    const idx = db.devices.findIndex(d => d.id === id);
    if (idx === -1) return null;
    db.devices[idx] = {
      ...db.devices[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    saveDataFile(db);
    return db.devices[idx];
  },

  deleteDevice(id: string): boolean {
    const db = this.getData();
    const initialLen = db.devices.length;
    db.devices = db.devices.filter(d => d.id !== id);
    db.assignments = db.assignments.filter(a => a.deviceId !== id);
    saveDataFile(db);
    return db.devices.length < initialLen;
  },

  getSounds(): SoundEntity[] {
    return this.getData().sounds;
  },

  getSoundById(id: string): SoundEntity | undefined {
    return this.getSounds().find(s => s.id === id);
  },

  addSound(sound: Omit<SoundEntity, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): SoundEntity {
    const db = this.getData();

    // Same identity rule as devices: honour the browser's IndexedDB id when given.
    const existing = sound.id ? db.sounds.find(s => s.id === sound.id) : undefined;
    if (existing) {
      existing.name = sound.name;
      existing.fileUrl = sound.fileUrl;
      existing.duration = sound.duration;
      existing.waveform = sound.waveform;
      existing.updatedAt = new Date().toISOString();
      saveDataFile(db);
      return existing;
    }

    const newSound: SoundEntity = {
      ...sound,
      id: sound.id || 'snd_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.sounds.unshift(newSound);
    saveDataFile(db);
    return newSound;
  },

  deleteSound(id: string): boolean {
    const db = this.getData();
    const initialLen = db.sounds.length;
    db.sounds = db.sounds.filter(s => s.id !== id);
    db.devices.forEach(d => {
      if (d.soundId === id) d.soundId = null;
    });
    db.assignments = db.assignments.filter(a => a.soundId !== id);
    saveDataFile(db);
    return db.sounds.length < initialLen;
  },

  getAssignments(): DeviceSoundAssignmentEntity[] {
    return this.getData().assignments;
  },

  assignSoundToDevice(
    deviceId: string,
    soundId: string,
    volume: number = 80,
    maxDurationMs: number = 5000
  ): DeviceSoundAssignmentEntity {
    const db = this.getData();
    let asgn = db.assignments.find(a => a.deviceId === deviceId);
    if (asgn) {
      asgn.soundId = soundId;
      asgn.volume = volume;
      asgn.maxDurationMs = maxDurationMs;
      asgn.updatedAt = new Date().toISOString();
    } else {
      asgn = {
        id: 'asgn_' + Math.random().toString(36).substring(2, 9),
        deviceId,
        soundId,
        enabled: true,
        volume,
        maxDurationMs,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.assignments.push(asgn);
    }
    const dev = db.devices.find(d => d.id === deviceId);
    if (dev) {
      dev.soundId = soundId;
      dev.updatedAt = new Date().toISOString();
    }
    saveDataFile(db);
    return asgn;
  },

  getPlaybackEvents(): PlaybackEventEntity[] {
    return this.getData().playbackEvents;
  },

  addPlaybackEvent(event: Omit<PlaybackEventEntity, 'id' | 'timestamp'>): PlaybackEventEntity {
    const db = this.getData();
    const dev = db.devices.find(d => d.id === event.deviceId);
    const snd = event.soundId ? db.sounds.find(s => s.id === event.soundId) : undefined;

    const newEvent: PlaybackEventEntity = {
      ...event,
      id: 'evt_' + Math.random().toString(36).substring(2, 9),
      deviceName: dev?.name || event.deviceName || 'Bluetooth Device',
      soundName: snd?.name || event.soundName || 'Custom Sound',
      timestamp: new Date().toISOString()
    };
    db.playbackEvents.unshift(newEvent);
    if (db.playbackEvents.length > 100) {
      db.playbackEvents = db.playbackEvents.slice(0, 100);
    }
    saveDataFile(db);
    return newEvent;
  },

  getSettings(): SettingsEntity {
    const db = this.getData();
    if (!db.settings || db.settings.length === 0) {
      const defaultSett: SettingsEntity = {
        id: 'sett_usr_default',
        userId: 'usr_default_101',
        autoPlay: true,
        defaultVolume: 80,
        maxDurationMs: 5000,
        androidSyncEnabled: true,
        updatedAt: new Date().toISOString()
      };
      db.settings = [defaultSett];
      saveDataFile(db);
      return defaultSett;
    }
    return db.settings[0];
  },

  updateSettings(updates: Partial<SettingsEntity>): SettingsEntity {
    const db = this.getData();
    const current = this.getSettings();
    const updated: SettingsEntity = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    db.settings[0] = updated;
    saveDataFile(db);
    return updated;
  },

  getUserByToken(token: string): UserEntity | undefined {
    return this.getData().users.find(u => u.companionToken === token);
  }
};

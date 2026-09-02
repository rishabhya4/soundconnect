/**
 * Shared companion sync payload builder.
 * Used by both /api/companion/sync (dashboard status panel) and
 * /api/v1/android/sync (Android companion app).
 */

import { dbStore, UserEntity } from './store';

export function resolveCompanionUser(request: Request): UserEntity | undefined {
  const authHeader = request.headers.get('Authorization') || '';
  const tokenHeader = request.headers.get('X-Companion-Token') || '';
  const token = tokenHeader || authHeader.replace('Bearer ', '');

  return token ? dbStore.getUserByToken(token) : dbStore.getData().users[0];
}

export function buildSyncPayload(user: UserEntity, origin: string) {
  const devices = dbStore.getDevices().filter(d => d.userId === user.id && d.enabled);
  const sounds = dbStore.getSounds().filter(s => s.userId === user.id);
  const assignments = dbStore.getAssignments();
  const settings = dbStore.getSettings();

  // Companions run off-origin (phone, native host), so relative /sounds/x.wav
  // paths have to be absolute before they're handed over for download.
  const absolute = (fileUrl: string) =>
    fileUrl && fileUrl.startsWith('/') ? `${origin}${fileUrl}` : fileUrl;

  return {
    user: { id: user.id, email: user.email },
    settings: {
      autoPlay: settings.autoPlay,
      defaultVolume: settings.defaultVolume,
      maxDurationMs: settings.maxDurationMs
    },
    devices: devices.map(device => {
      const assignment = assignments.find(a => a.deviceId === device.id && a.enabled);
      const sound = assignment ? sounds.find(s => s.id === assignment.soundId) : null;

      return {
        id: device.id,
        deviceIdentifier: device.deviceIdentifier,
        name: device.name,
        type: device.type,
        connectionMode: device.connectionMode,
        assignment: assignment
          ? {
              id: assignment.id,
              soundId: assignment.soundId,
              volume: assignment.volume,
              maxDurationMs: assignment.maxDurationMs,
              sound: sound
                ? {
                    id: sound.id,
                    name: sound.name,
                    fileUrl: absolute(sound.fileUrl),
                    duration: sound.duration
                  }
                : null
            }
          : null
      };
    }),
    syncedAt: new Date().toISOString()
  };
}

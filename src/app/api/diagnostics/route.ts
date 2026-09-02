import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/store';

export async function GET() {
  try {
    const devices = dbStore.getDevices();
    const sounds = dbStore.getSounds();
    const events = dbStore.getPlaybackEvents();
    const settings = dbStore.getSettings();

    return NextResponse.json({
      success: true,
      diagnostics: {
        serverTime: new Date().toISOString(),
        devicesCount: devices.length,
        enabledDevicesCount: devices.filter(d => d.enabled).length,
        soundsCount: sounds.length,
        playbackEventsCount: events.length,
        lastPlaybackEvent: events[0] || null,
        settings
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

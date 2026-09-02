import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, deviceName, status, source } = body;

    const event = dbStore.addPlaybackEvent({
      deviceId: deviceId || 'win_dev_unk',
      deviceName: deviceName || 'Windows Bluetooth Audio',
      status: status || 'SUCCESS',
      source: 'WINDOWS_COMPANION'
    });

    return NextResponse.json({ success: true, event });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

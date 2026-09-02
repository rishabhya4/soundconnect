import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/store';

export async function GET() {
  try {
    const events = dbStore.getPlaybackEvents();
    return NextResponse.json({ success: true, events });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, soundId, status, source, errorMessage, deviceName, soundName } = body;

    if (!deviceId || !status) {
      return NextResponse.json(
        { success: false, error: 'deviceId and status are required.' },
        { status: 400 }
      );
    }

    const event = dbStore.addPlaybackEvent({
      deviceId,
      deviceName,
      soundId: soundId || null,
      soundName,
      status: status as 'SUCCESS' | 'SKIPPED' | 'FAILED',
      source: (source || 'WEB_BLUETOOTH') as 'WEB_BLUETOOTH' | 'ANDROID_COMPANION' | 'TEST_PREVIEW',
      errorMessage
    });

    return NextResponse.json({ success: true, event }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

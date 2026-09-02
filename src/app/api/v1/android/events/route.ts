import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const tokenHeader = request.headers.get('X-Companion-Token') || '';
    const token = tokenHeader || authHeader.replace('Bearer ', '');

    const user = token ? dbStore.getUserByToken(token) : dbStore.getData().users[0];
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized companion app request' }, { status: 401 });
    }

    const body = await request.json();
    const { deviceId, deviceName, soundId, soundName, status, errorMessage } = body;

    if (!deviceId || !status) {
      return NextResponse.json(
        { success: false, error: 'deviceId and status are required' },
        { status: 400 }
      );
    }

    const event = dbStore.addPlaybackEvent({
      deviceId,
      deviceName,
      soundId,
      soundName,
      status: status as 'SUCCESS' | 'SKIPPED' | 'FAILED',
      source: 'ANDROID_COMPANION',
      errorMessage
    });

    return NextResponse.json({ success: true, event }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

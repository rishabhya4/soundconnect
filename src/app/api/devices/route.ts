import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/store';

export async function GET() {
  try {
    const devices = dbStore.getDevices();
    return NextResponse.json({ success: true, devices });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, deviceIdentifier, name, type, connectionMode, enabled, soundId } = body;

    if (!name || !deviceIdentifier) {
      return NextResponse.json(
        { success: false, error: 'Device name and identifier are required.' },
        { status: 400 }
      );
    }

    const device = dbStore.addDevice({
      id,
      userId: 'usr_default_101',
      deviceIdentifier,
      name,
      type: type || 'EARBUDS',
      connectionMode: connectionMode || 'WEB_BLUETOOTH',
      enabled: enabled !== false,
      soundId: soundId || null
    });

    return NextResponse.json({ success: true, device }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

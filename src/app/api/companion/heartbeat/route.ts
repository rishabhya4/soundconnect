import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const tokenHeader = request.headers.get('X-Companion-Token') || '';
    const token = tokenHeader || authHeader.replace('Bearer ', '');

    const user = token ? dbStore.getUserByToken(token) : dbStore.getData().users[0];
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { platform, appVersion, activeDevicesCount } = body;

    return NextResponse.json({
      success: true,
      heartbeat: {
        receivedAt: new Date().toISOString(),
        status: 'ACTIVE',
        activeDevicesCount: activeDevicesCount || 0
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

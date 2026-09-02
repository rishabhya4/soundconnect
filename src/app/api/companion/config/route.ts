import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/store';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const tokenHeader = request.headers.get('X-Companion-Token') || '';
    const token = tokenHeader || authHeader.replace('Bearer ', '');

    const user = token ? dbStore.getUserByToken(token) : dbStore.getData().users[0];
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const settings = dbStore.getSettings();
    return NextResponse.json({
      success: true,
      config: {
        userId: user.id,
        autoPlay: settings.autoPlay,
        defaultVolume: settings.defaultVolume,
        maxDurationMs: settings.maxDurationMs,
        syncedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/store';

export async function GET() {
  try {
    const assignments = dbStore.getAssignments();
    return NextResponse.json({ success: true, assignments });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, soundId, volume, maxDurationMs } = body;

    if (!deviceId || !soundId) {
      return NextResponse.json(
        { success: false, error: 'deviceId and soundId are required.' },
        { status: 400 }
      );
    }

    const assignment = dbStore.assignSoundToDevice(
      deviceId,
      soundId,
      volume ?? 80,
      maxDurationMs ?? 5000
    );

    return NextResponse.json({ success: true, assignment });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { dbStore } from '@/lib/store';

const SOUNDS_DIR = path.join(process.cwd(), 'public', 'sounds');

/**
 * Persist a base64 data URL as a real file under public/sounds so the Android and
 * Windows companions can download it, instead of bloating db.json with megabytes
 * of base64 per clip.
 */
function writeSoundFile(id: string, dataUrl: string): string {
  if (!fs.existsSync(SOUNDS_DIR)) {
    fs.mkdirSync(SOUNDS_DIR, { recursive: true });
  }
  const base64 = dataUrl.substring(dataUrl.indexOf('base64,') + 'base64,'.length);
  const ext = dataUrl.includes('audio/wav') || dataUrl.includes('audio/x-wav') ? 'wav' : 'mp3';
  const fileName = `${id}.${ext}`;
  fs.writeFileSync(path.join(SOUNDS_DIR, fileName), Buffer.from(base64, 'base64'));
  return `/sounds/${fileName}`;
}

function removeSoundFile(fileUrl?: string): void {
  if (!fileUrl || !fileUrl.startsWith('/sounds/')) return;
  const filePath = path.join(SOUNDS_DIR, path.basename(fileUrl));
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.warn('Could not remove sound file:', err);
  }
}

export async function GET() {
  try {
    const sounds = dbStore.getSounds();
    return NextResponse.json({ success: true, sounds });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, dataUrl, duration, waveform } = body;
    let { fileUrl } = body;

    if (!name || (!fileUrl && !dataUrl)) {
      return NextResponse.json(
        { success: false, error: 'Sound name and audio data (fileUrl or dataUrl) are required.' },
        { status: 400 }
      );
    }

    const soundId = id || 'snd_' + Math.random().toString(36).substring(2, 9);
    if (dataUrl) {
      fileUrl = writeSoundFile(soundId, dataUrl);
    }

    const sound = dbStore.addSound({
      id: soundId,
      userId: 'usr_default_101',
      name,
      fileUrl,
      duration: duration || 2.5,
      waveform: waveform || []
    });

    return NextResponse.json({ success: true, sound }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Sound ID required' }, { status: 400 });
    }
    removeSoundFile(dbStore.getSoundById(id)?.fileUrl);
    const deleted = dbStore.deleteSound(id);
    return NextResponse.json({ success: deleted });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

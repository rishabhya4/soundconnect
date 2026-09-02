import { NextResponse } from 'next/server';
import { buildSyncPayload, resolveCompanionUser } from '@/lib/companion-sync';

export async function GET(request: Request) {
  try {
    const user = resolveCompanionUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized companion app request' }, { status: 401 });
    }

    const payload = buildSyncPayload(user, new URL(request.url).origin);
    return NextResponse.json({ success: true, payload });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

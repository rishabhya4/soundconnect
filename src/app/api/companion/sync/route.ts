import { NextResponse } from 'next/server';
import { buildSyncPayload, resolveCompanionUser } from '@/lib/companion-sync';

/**
 * Dashboard-facing alias of /api/v1/android/sync, used by the /companion page
 * to show what the companion apps will receive.
 */
export async function GET(request: Request) {
  try {
    const user = resolveCompanionUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = buildSyncPayload(user, new URL(request.url).origin);
    return NextResponse.json({ success: true, payload });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

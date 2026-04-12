import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createAdminSupabase } from '@/lib/supabase-admin';
import type { Database } from '@/types/database';

/** Persist team chat room header URL after client uploads to Storage. Uses service role so RLS cannot block. */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_demo')?.value === 'true') {
    return NextResponse.json({ error: 'Demo mode' }, { status: 403 });
  }
  if (cookieStore.get('pirates_code_verified')?.value !== 'true') {
    return NextResponse.json({ error: 'Team code required' }, { status: 403 });
  }

  let payload: { header_image_url?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const header_image_url = String(payload.header_image_url ?? '').trim();
  if (!header_image_url || !/^https?:\/\//i.test(header_image_url)) {
    return NextResponse.json({ error: 'Valid header_image_url (https URL) required' }, { status: 400 });
  }

  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createAdminSupabase() as import('@supabase/supabase-js').SupabaseClient<any>;
    const { error } = await admin.from('team_chat_settings').upsert(
      { id: 1, header_image_url, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error';
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY') || msg.includes('Missing')) {
      return NextResponse.json(
        { error: 'Set SUPABASE_SERVICE_ROLE_KEY on the server to save the team chat image.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

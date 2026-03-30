import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { isDashboardAdmin } from '@/lib/admin-request';
import type { Database } from '@/types/database';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_demo')?.value === 'true') {
    return NextResponse.json({ error: 'Demo mode' }, { status: 403 });
  }

  let payload: { body?: string; sender_name?: string; is_alert?: boolean } = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const text = String(payload.body ?? '').trim();
  const senderName = String(payload.sender_name ?? '').trim();
  const isAlert = Boolean(payload.is_alert);

  if (!text || text.length > 4000) {
    return NextResponse.json({ error: 'Message required (max 4000 characters)' }, { status: 400 });
  }

  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const name = senderName || user.email?.split('@')[0] || 'Member';

  if (isAlert) {
    const allowed = await isDashboardAdmin();
    if (!allowed) {
      return NextResponse.json({ error: 'Alerts require admin access' }, { status: 403 });
    }
    try {
      const admin = createAdminSupabase() as unknown as SupabaseClient<any>;
      const { data, error } = await admin
        .from('team_chat_messages')
        .insert({
          user_id: user.id,
          sender_name: name,
          body: text,
          is_alert: true,
        })
        .select()
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ data });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Server error';
      if (msg.includes('SUPABASE_SERVICE_ROLE_KEY') || msg.includes('Missing')) {
        return NextResponse.json(
          { error: 'Alerts need SUPABASE_SERVICE_ROLE_KEY on the server' },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  const userDb = supabase as unknown as SupabaseClient<any>;
  const { data, error } = await userDb
    .from('team_chat_messages')
    .insert({
      user_id: user.id,
      sender_name: name,
      body: text,
      is_alert: false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ data });
}

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

const TWENTY_MIN_MS = 20 * 60 * 1000;

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_demo')?.value === 'true') {
    return NextResponse.json({ error: 'Demo mode' }, { status: 403 });
  }

  let payload: { id?: string; body?: string; sender_name?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const id = String(payload.id ?? '').trim();
  const text = String(payload.body ?? '').trim();
  const senderClient = String(payload.sender_name ?? '').trim();

  if (!id || !text || text.length > 4000) {
    return NextResponse.json({ error: 'Valid id and message body required' }, { status: 400 });
  }

  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userDb = supabase as unknown as SupabaseClient<any>;
  const { data: row, error: fetchErr } = await userDb
    .from('team_chat_messages')
    .select('id, user_id, sender_name, created_at')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  const admin = await isDashboardAdmin();

  if (admin) {
    try {
      const adminClient = createAdminSupabase() as unknown as SupabaseClient<any>;
      const name = senderClient || String((row as { sender_name?: string }).sender_name ?? '');
      const { data, error } = await adminClient
        .from('team_chat_messages')
        .update({ body: text, sender_name: name })
        .eq('id', id)
        .select()
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ data });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Server error';
      if (msg.includes('SUPABASE_SERVICE_ROLE_KEY') || msg.includes('Missing')) {
        return NextResponse.json({ error: 'Admin edits need SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 });
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if ((row as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: 'You can only edit your own messages' }, { status: 403 });
  }
  const created = new Date((row as { created_at: string }).created_at).getTime();
  if (Date.now() - created > TWENTY_MIN_MS) {
    return NextResponse.json({ error: 'Edit window expired (20 minutes after posting)' }, { status: 403 });
  }

  const name = senderClient || user.email?.split('@')[0] || 'Member';
  const { data, error } = await userDb
    .from('team_chat_messages')
    .update({ body: text, sender_name: name })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_demo')?.value === 'true') {
    return NextResponse.json({ error: 'Demo mode' }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get('id')?.trim();
  if (!id) {
    return NextResponse.json({ error: 'id query required' }, { status: 400 });
  }

  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userDb = supabase as unknown as SupabaseClient<any>;
  const { data: row, error: fetchErr } = await userDb
    .from('team_chat_messages')
    .select('id, user_id, created_at')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  const admin = await isDashboardAdmin();

  if (admin) {
    try {
      const adminClient = createAdminSupabase() as unknown as SupabaseClient<any>;
      const { error } = await adminClient.from('team_chat_messages').delete().eq('id', id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Server error';
      if (msg.includes('SUPABASE_SERVICE_ROLE_KEY') || msg.includes('Missing')) {
        return NextResponse.json({ error: 'Admin deletes need SUPABASE_SERVICE_ROLE_KEY' }, { status: 503 });
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if ((row as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: 'You can only delete your own messages' }, { status: 403 });
  }
  const created = new Date((row as { created_at: string }).created_at).getTime();
  if (Date.now() - created > TWENTY_MIN_MS) {
    return NextResponse.json({ error: 'Delete window expired (20 minutes after posting)' }, { status: 403 });
  }

  const { error } = await userDb.from('team_chat_messages').delete().eq('id', id).eq('user_id', user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

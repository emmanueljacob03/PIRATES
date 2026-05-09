import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const MAX_BODY = 500;

export async function GET() {
  try {
    const admin = createAdminSupabase();
    const { data, error } = await admin
      .from('live_stream_chat')
      .select('id, author_name, body, created_at')
      .order('created_at', { ascending: false })
      .limit(120);
    if (error) throw error;
    const rows = (data ?? []).slice().reverse();
    return NextResponse.json({ messages: rows });
  } catch (e: unknown) {
    const msg = typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
    if (msg.includes('live_stream_chat') || msg.includes('schema cache')) {
      return NextResponse.json(
        { error: 'Live chat table not installed. Run live_stream_chat.sql in Supabase.', messages: [] },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: 'Could not load messages', messages: [] }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const raw = typeof json === 'object' && json && 'body' in json ? String((json as { body: unknown }).body) : '';
  const bodyText = raw.trim().slice(0, MAX_BODY);
  if (!bodyText) return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in inside the Pirates app to post.' }, { status: 401 });

  const { data: prof } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle();

  const pname = prof as { name: string | null } | null;
  const authorName =
    (pname?.name ?? '').trim() || user.email?.split('@')[0]?.trim() || 'Player';

  // Supabase codegen-style Insert inference can resolve to `never` for freshly added tables; cast keeps runtime RLS-backed insert.
  const { data: row, error } = await (supabase as any)
    .from('live_stream_chat')
    .insert({
      profile_id: user.id,
      author_name: authorName,
      body: bodyText,
    })
    .select('id, author_name, body, created_at')
    .single();

  if (error) {
    const m = error.message ?? '';
    if (m.includes('profiles') || m.includes('violates')) {
      return NextResponse.json(
        { error: 'Profile not ready for chat yet. Reload after your account finishes setup.' },
        { status: 403 },
      );
    }
    if (m.includes('live_stream_chat') || m.includes('schema cache')) {
      return NextResponse.json(
        { error: 'Live chat table not installed. Run live_stream_chat.sql in Supabase.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: m || 'Could not save message' }, { status: 400 });
  }

  return NextResponse.json({ message: row });
}

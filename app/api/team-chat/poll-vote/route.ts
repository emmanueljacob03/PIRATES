import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database';
import { parseChatBody } from '@/lib/chat-parse';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_demo')?.value === 'true') {
    return NextResponse.json({ error: 'Demo mode' }, { status: 403 });
  }

  let payload: { message_id?: string; option_index?: number } = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const messageId = String(payload.message_id ?? '').trim();
  const optionIndex = Number(payload.option_index);
  if (!messageId || !Number.isInteger(optionIndex) || optionIndex < 0) {
    return NextResponse.json({ error: 'message_id and option_index required' }, { status: 400 });
  }

  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: row, error: fetchErr } = await supabase
    .from('team_chat_messages')
    .select('body')
    .eq('id', messageId)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  const parsed = parseChatBody((row as { body: string }).body);
  if (parsed.kind !== 'poll' || optionIndex >= parsed.options.length) {
    return NextResponse.json({ error: 'Invalid poll or option' }, { status: 400 });
  }

  const userDb = supabase as unknown as import('@supabase/supabase-js').SupabaseClient;
  const { error: upsertErr } = await userDb.from('team_chat_poll_votes').upsert(
    {
      message_id: messageId,
      user_id: user.id,
      option_index: optionIndex,
    },
    { onConflict: 'message_id,user_id' },
  );

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { memoryDuties, type MemoryDuty } from '@/lib/umpiring-duties-memory';

async function resolveWho(
  supabase: ReturnType<typeof createAdminSupabase>,
  body: { who?: string; player_id?: string | null },
): Promise<string | null> {
  let who = typeof body.who === 'string' ? body.who.trim() : '';
  if (body.player_id) {
    const { data: pl } = await (supabase as any).from('players').select('name').eq('id', body.player_id).single();
    const name = (pl as { name?: string } | null)?.name?.trim() ?? '';
    if (name && !who) who = name;
  }
  return who || null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_admin')?.value !== 'true') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { id } = await params;
  let body: {
    who?: string;
    player_id?: string | null;
    duty_date?: string;
    duty_time?: string;
    notes?: string | null;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const duty_date =
    typeof body.duty_date === 'string' && body.duty_date
      ? body.duty_date.slice(0, 10)
      : undefined;
  const duty_time =
    typeof body.duty_time === 'string' && body.duty_time.trim()
      ? body.duty_time.trim()
      : undefined;
  const notes = typeof body.notes === 'string' ? body.notes.trim() : body.notes === null ? '' : undefined;
  const player_id = body.player_id === undefined ? undefined : body.player_id;

  const memIdx = memoryDuties.findIndex((m) => m.id === id);
  if (memIdx >= 0) {
    const cur = memoryDuties[memIdx]!;
    let who = typeof body.who === 'string' ? body.who.trim() : '';
    if (!who) who = cur.who.trim();
    const pid = player_id !== undefined ? player_id : cur.player_id;
    if (!who && pid) {
      try {
        const supabase = createAdminSupabase();
        who = (await resolveWho(supabase, { who: '', player_id: pid })) ?? '';
      } catch {
        /* keep who */
      }
    }
    if (!who) return NextResponse.json({ error: 'Who is required' }, { status: 400 });
    const next: MemoryDuty = {
      ...cur,
      who,
      duty_date: duty_date ?? cur.duty_date,
      duty_time: duty_time ?? cur.duty_time,
      notes: notes !== undefined ? notes : cur.notes,
      player_id: pid ?? null,
    };
    memoryDuties[memIdx] = next;
    return NextResponse.json(next);
  }

  try {
    const supabase = createAdminSupabase();
    const who = await resolveWho(supabase, body);
    if (!who) return NextResponse.json({ error: 'Who is required' }, { status: 400 });

    const patch: Record<string, unknown> = { who };
    if (duty_date !== undefined) patch.duty_date = duty_date;
    if (duty_time !== undefined) patch.duty_time = duty_time;
    if (notes !== undefined) patch.notes = notes || null;
    if (player_id !== undefined) patch.player_id = player_id;

    const { data, error } = await (supabase as any).from('umpiring_duties').update(patch).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'Server needs SUPABASE_SERVICE_ROLE_KEY in .env.local.' }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_admin')?.value !== 'true') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { id } = await params;
  const memIdx = memoryDuties.findIndex((m) => m.id === id);
  if (memIdx >= 0) {
    memoryDuties.splice(memIdx, 1);
    return NextResponse.json({ ok: true });
  }

  try {
    const supabase = createAdminSupabase();
    const { error } = await (supabase as any).from('umpiring_duties').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'Server needs SUPABASE_SERVICE_ROLE_KEY in .env.local.' }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

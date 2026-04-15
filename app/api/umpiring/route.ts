import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { memoryDuties, nextMemoryDutyId, type MemoryDuty } from '@/lib/umpiring-duties-memory';

function sortDutyRows<T extends { duty_date: string; duty_time?: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const da = `${a.duty_date?.slice(0, 10) ?? ''}T${(a.duty_time || '12:00').trim() || '12:00'}`;
    const db = `${b.duty_date?.slice(0, 10) ?? ''}T${(b.duty_time || '12:00').trim() || '12:00'}`;
    return new Date(da).getTime() - new Date(db).getTime();
  });
}

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await (supabase as any)
      .from('umpiring_duties')
      .select('*')
      .order('duty_date', { ascending: true });
    if (!error && Array.isArray(data)) return NextResponse.json(sortDutyRows(data));
  } catch {
    /* memory */
  }
  return NextResponse.json(sortDutyRows(memoryDuties));
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_admin')?.value !== 'true') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  let body: { player_id?: string; duty_date?: string; duty_time?: string; notes?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const player_id = typeof body.player_id === 'string' ? body.player_id.trim() : '';
  const duty_date =
    typeof body.duty_date === 'string' && body.duty_date
      ? body.duty_date.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const duty_time = typeof body.duty_time === 'string' && body.duty_time.trim() ? body.duty_time.trim() : '12:00';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

  if (!player_id) return NextResponse.json({ error: 'Player is required' }, { status: 400 });

  try {
    const supabase = createAdminSupabase();
    const { data: pl, error: plErr } = await (supabase as any).from('players').select('name').eq('id', player_id).single();
    if (plErr || !pl) return NextResponse.json({ error: 'Player not found' }, { status: 400 });
    const who = String((pl as { name?: string }).name ?? '').trim();
    if (!who) return NextResponse.json({ error: 'Player has no name' }, { status: 400 });

    const { data, error } = await (supabase as any)
      .from('umpiring_duties')
      .insert({ who, player_id, duty_date, duty_time, notes: notes || null })
      .select()
      .single();
    if (error) {
      const em = String(error.message ?? '');
      if (em.includes('player_id') || em.includes('duty_time') || em.includes('column')) {
        return NextResponse.json(
          {
            error:
              'Database missing player_id/duty_time columns. Run supabase/alter_umpiring_duties_player_time.sql in Supabase SQL Editor.',
          },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: em || 'Insert failed' }, { status: 400 });
    }
    if (data) return NextResponse.json(data);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'Server needs SUPABASE_SERVICE_ROLE_KEY in .env.local.' }, { status: 503 });
    }
  }

  let whoMem = '';
  try {
    const supabase = createAdminSupabase();
    const { data: pl } = await (supabase as any).from('players').select('name').eq('id', player_id).single();
    whoMem = String((pl as { name?: string })?.name ?? '').trim();
  } catch {
    whoMem = '';
  }
  if (!whoMem) whoMem = 'Player';
  const duty: MemoryDuty = {
    id: nextMemoryDutyId(),
    who: whoMem,
    duty_date,
    duty_time,
    notes,
    player_id,
  };
  memoryDuties.push(duty);
  return NextResponse.json(duty);
}

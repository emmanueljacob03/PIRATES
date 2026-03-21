import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_code_verified')?.value !== 'true' && cookieStore.get('pirates_demo')?.value !== 'true') {
    return NextResponse.json({ error: 'Team code required' }, { status: 403 });
  }

  let body: { player_name?: string; jersey_number?: number; size?: string; paid?: boolean; notes?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const player_name = (body.player_name ?? '').trim();
  const jersey_number = body.jersey_number ?? 0;
  const size = (body.size ?? 'M').trim();
  const paid = body.paid ?? false;
  const notes = body.notes?.trim() ?? null;
  if (!player_name || !jersey_number) {
    return NextResponse.json({ error: 'Player name and jersey number required' }, { status: 400 });
  }

  try {
    const supabase = createAdminSupabase();
    const { data, error } = await (supabase as any).from('jerseys').insert({
      player_name,
      jersey_number,
      size,
      paid,
      notes,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'Server needs SUPABASE_SERVICE_ROLE_KEY for jerseys.' }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_admin')?.value !== 'true') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  let body: { id?: string; paid?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const id = body.id;
  const paid = body.paid;
  if (!id || typeof paid !== 'boolean') {
    return NextResponse.json({ error: 'id and paid required' }, { status: 400 });
  }

  try {
    const supabase = createAdminSupabase();
    const { data, error } = await (supabase as any).from('jerseys').update({ paid }).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_code_verified')?.value !== 'true' && cookieStore.get('pirates_demo')?.value !== 'true') {
    return NextResponse.json({ error: 'Team code required' }, { status: 403 });
  }

  let body: { player_name?: string; jersey_number?: string | number; size?: string; paid?: boolean; notes?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const player_name = (body.player_name ?? '').trim();
  const rawNum = body.jersey_number;
  const jersey_number =
    typeof rawNum === 'number' && Number.isFinite(rawNum) ? String(rawNum) : String(rawNum ?? '').trim();
  const size = (body.size ?? 'M').trim();
  const paid = body.paid ?? false;
  const notes = body.notes?.trim() ?? null;
  if (!player_name || !jersey_number || !/^\d{1,4}$/.test(jersey_number)) {
    return NextResponse.json({ error: 'Player name and a valid jersey number (1–4 digits) required' }, { status: 400 });
  }

  let submitted_by_id: string | null = null;
  try {
    const userClient = await createServerSupabase();
    const {
      data: { user },
    } = await userClient.auth.getUser();
    submitted_by_id = user?.id ?? null;
  } catch {
    /* ignore */
  }

  try {
    const supabase = createAdminSupabase();
    const { data, error } = await (supabase as any).from('jerseys').insert({
      player_name,
      jersey_number,
      size,
      paid,
      notes,
      submitted_by_id,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    let out = data as Record<string, unknown>;
    if (submitted_by_id && out) {
      const { data: prof } = await (supabase as any)
        .from('profiles')
        .select('name')
        .eq('id', submitted_by_id)
        .maybeSingle();
      out = { ...out, submitter_name: (prof as { name?: string } | null)?.name ?? null };
    }
    return NextResponse.json(out);
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

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { legacyJerseySubmitterProfileId } from '@/lib/jersey-legacy-account';

export const dynamic = 'force-dynamic';

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
  const isAdmin = cookieStore.get('pirates_admin')?.value === 'true';
  const codeOk =
    cookieStore.get('pirates_code_verified')?.value === 'true' || cookieStore.get('pirates_demo')?.value === 'true';

  let body: {
    id?: string;
    paid?: boolean;
    player_name?: string;
    size?: string;
    notes?: string | null;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  let userId: string | null = null;
  try {
    const userClient = await createServerSupabase();
    const {
      data: { user },
    } = await userClient.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    /* ignore */
  }

  if (!isAdmin) {
    if (!codeOk || !userId) {
      return NextResponse.json({ error: 'Sign in with team code to edit your request' }, { status: 403 });
    }
    const supabaseCheck = createAdminSupabase();
    const { data: row, error: fetchErr } = await (supabaseCheck as any)
      .from('jerseys')
      .select('submitted_by_id, player_name')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr || !row) return NextResponse.json({ error: 'Jersey not found' }, { status: 404 });
    const r = row as { submitted_by_id?: string | null; player_name?: string };
    let owns = r.submitted_by_id === userId;
    if (!owns && !r.submitted_by_id) {
      const { data: players } = await (supabaseCheck as any).from('players').select('name, profile_id');
      const inferred = legacyJerseySubmitterProfileId(r.player_name, players ?? []);
      owns = inferred === userId;
    }
    if (!owns) {
      return NextResponse.json({ error: 'You can only edit your own jersey request' }, { status: 403 });
    }
    if (body.paid !== undefined) {
      return NextResponse.json({ error: 'Only admin can change paid status' }, { status: 403 });
    }
  }

  const updates: Record<string, unknown> = {};
  if (isAdmin && typeof body.paid === 'boolean') updates.paid = body.paid;
  if (body.player_name !== undefined) {
    const pn = String(body.player_name).trim();
    if (!pn) return NextResponse.json({ error: 'player_name cannot be empty' }, { status: 400 });
    updates.player_name = pn;
  }
  if (body.size !== undefined) {
    const sz = String(body.size).trim();
    if (!sz) return NextResponse.json({ error: 'size cannot be empty' }, { status: 400 });
    updates.size = sz;
  }
  if (body.notes !== undefined) {
    const n = body.notes === null ? null : String(body.notes).trim();
    updates.notes = n || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'id and at least one field required' }, { status: 400 });
  }

  try {
    const supabase = createAdminSupabase();
    const { data, error } = await (supabase as any).from('jerseys').update(updates).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    let out = data as Record<string, unknown>;
    const sid = (out as { submitted_by_id?: string | null }).submitted_by_id;
    if (sid) {
      const { data: prof } = await (supabase as any)
        .from('profiles')
        .select('name')
        .eq('id', sid)
        .maybeSingle();
      out = { ...out, submitter_name: (prof as { name?: string } | null)?.name ?? null };
    }
    try {
      revalidatePath('/dashboard');
      revalidatePath('/profiles');
    } catch {
      /* ignore */
    }
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

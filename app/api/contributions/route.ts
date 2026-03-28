import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const isAdminCookie = cookieStore.get('pirates_admin')?.value === 'true';
  const codeOk = cookieStore.get('pirates_code_verified')?.value === 'true';

  let body: {
    player_name?: string;
    amount?: number;
    paid?: boolean;
    date?: string;
    notes?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const amount = typeof body.amount === 'number' ? body.amount : parseFloat(String(body.amount));
  if (isNaN(amount)) {
    return NextResponse.json({ error: 'amount required' }, { status: 400 });
  }

  const date = (body.date ?? new Date().toISOString().slice(0, 10)).toString().slice(0, 10);
  const notesRaw = (body.notes ?? '').trim().slice(0, 500);

  try {
    const supabase = createAdminSupabase();

    if (isAdminCookie) {
      const player_name = (body.player_name ?? '').trim();
      if (!player_name) {
        return NextResponse.json({ error: 'player_name and amount required' }, { status: 400 });
      }
      const paid = !!body.paid;
      const { data, error } = await (supabase as any)
        .from('contributions')
        .insert({
          player_name,
          amount,
          paid,
          date,
          notes: notesRaw || null,
          submitted_by_id: null,
        })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json(data);
    }

    if (!codeOk) {
      return NextResponse.json({ error: 'Team code required' }, { status: 403 });
    }

    const userClient = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in to add a match fee or donation note.' }, { status: 401 });
    }

    const { data: prof } = await userClient.from('profiles').select('name').eq('id', user.id).maybeSingle();
    const displayName = ((prof as { name?: string } | null)?.name || user.email || 'Member').trim();

    const { data, error } = await (supabase as any)
      .from('contributions')
      .insert({
        player_name: displayName,
        amount,
        paid: false,
        date,
        notes: notesRaw || null,
        submitted_by_id: user.id,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_admin')?.value !== 'true') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  let body: { id?: string; paid?: boolean; amount?: number } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const id = body.id;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const updates: { paid?: boolean; amount?: number } = {};
  if (typeof body.paid === 'boolean') updates.paid = body.paid;
  if (typeof body.amount === 'number') updates.amount = body.amount;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'paid or amount required' }, { status: 400 });
  }

  try {
    const supabase = createAdminSupabase();
    const { data, error } = await (supabase as any).from('contributions').update(updates).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

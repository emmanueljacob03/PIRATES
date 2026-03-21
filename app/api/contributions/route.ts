import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_admin')?.value !== 'true') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }
  let body: { player_name?: string; amount?: number; paid?: boolean; date?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const player_name = (body.player_name ?? '').trim();
  const amount = typeof body.amount === 'number' ? body.amount : parseFloat(String(body.amount));
  if (!player_name || isNaN(amount)) {
    return NextResponse.json({ error: 'player_name and amount required' }, { status: 400 });
  }
  const paid = !!body.paid;
  const date = (body.date ?? new Date().toISOString().slice(0, 10)).toString().slice(0, 10);
  try {
    const supabase = createAdminSupabase();
    const { data, error } = await (supabase as any).from('contributions').insert({ player_name, amount, paid, date }).select().single();
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

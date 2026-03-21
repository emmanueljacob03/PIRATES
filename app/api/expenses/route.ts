import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';
  const isAdmin = cookieStore.get('pirates_admin')?.value === 'true';
  if (!codeVerified && !isAdmin) {
    return NextResponse.json({ error: 'Team code or admin required' }, { status: 403 });
  }
  let body: { category?: string; item?: string; cost?: number } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const category = (body.category ?? '').trim();
  const item = (body.item ?? '').trim();
  const cost = typeof body.cost === 'number' ? body.cost : parseFloat(String(body.cost ?? ''));
  if (!category || !item || isNaN(cost)) {
    return NextResponse.json({ error: 'category, item and cost required' }, { status: 400 });
  }
  try {
    const supabase = createAdminSupabase();

    // Identify who submitted the expense so admins can review/approve with context.
    let submittedById: string | null = null;
    let submittedByName: string | null = null;
    try {
      const userClient = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
      const {
        data: { user },
      } = await userClient.auth.getUser();
      if (user) {
        submittedById = user.id;
        const { data: profile } = await userClient
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single();
        submittedByName = (profile as { name?: string | null } | null)?.name ?? user.id;
      }
    } catch {
      // ignore, allow insert with null submitter fields
    }

    const { data, error } = await (supabase as any)
      .from('expenses')
      .insert({
        category,
        item,
        cost,
        bought: false,
        submitted_by_id: submittedById,
        submitted_by_name: submittedByName,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY') || msg.includes('Missing')) {
      return NextResponse.json({ error: 'Server config: add SUPABASE_SERVICE_ROLE_KEY to .env.local' }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';
  const isAdmin = cookieStore.get('pirates_admin')?.value === 'true';
  if (!codeVerified && !isAdmin) {
    return NextResponse.json({ error: 'Team code or admin required' }, { status: 403 });
  }
  let body: { id?: string; bought?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const id = body.id;
  if (!id || typeof body.bought !== 'boolean') {
    return NextResponse.json({ error: 'id and bought required' }, { status: 400 });
  }
  try {
    const supabase = createAdminSupabase();
    const { data, error } = await (supabase as any).from('expenses').update({ bought: body.bought }).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

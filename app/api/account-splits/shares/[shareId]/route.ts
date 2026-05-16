import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database';

export async function PATCH(req: NextRequest, { params }: { params: { shareId: string } }) {
  const shareId = params.shareId?.trim();
  if (!shareId) {
    return NextResponse.json({ error: 'Missing share id' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const codeOk = cookieStore.get('pirates_code_verified')?.value === 'true';
  if (!codeOk) {
    return NextResponse.json({ error: 'Team code required' }, { status: 403 });
  }

  const userClient = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  let body: { paid?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const paid = !!body.paid;

  try {
    const supabase = createAdminSupabase();
    const { data: share, error: fetchErr } = await (supabase as any)
      .from('account_split_shares')
      .select('id, participant_profile_id, split_id, account_splits(payer_profile_id, created_by_profile_id)')
      .eq('id', shareId)
      .maybeSingle();

    if (fetchErr || !share) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    }

    const splitRaw = (share as { account_splits: unknown }).account_splits;
    const split = Array.isArray(splitRaw) ? splitRaw[0] : splitRaw;
    const splitInfo = split as { payer_profile_id: string; created_by_profile_id: string } | null;

    const isParticipant = share.participant_profile_id === user.id;
    const isPayer = splitInfo?.payer_profile_id === user.id;
    const isCreator = splitInfo?.created_by_profile_id === user.id;

    let isAdmin = cookieStore.get('pirates_admin')?.value === 'true';
    if (!isAdmin) {
      const { data: prof } = await userClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
      isAdmin = (prof as { role?: string } | null)?.role === 'admin';
    }

    if (!isParticipant && !isPayer && !isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Not allowed to update this share' }, { status: 403 });
    }

    const { error: updateErr } = await (supabase as any)
      .from('account_split_shares')
      .update({
        paid,
        paid_at: paid ? new Date().toISOString() : null,
      })
      .eq('id', shareId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    try {
      revalidatePath('/accounts');
      revalidatePath('/profiles');
    } catch {
      /* ignore */
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Update failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

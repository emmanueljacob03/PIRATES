import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { equalShareAmounts } from '@/lib/account-splits';
import type { Database } from '@/types/database';

async function requireUser() {
  const cookieStore = await cookies();
  const codeOk = cookieStore.get('pirates_code_verified')?.value === 'true';
  if (!codeOk) {
    return { error: NextResponse.json({ error: 'Team code required' }, { status: 403 }) };
  }
  const userClient = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Sign in required' }, { status: 401 }) };
  }
  return { user, cookieStore, userClient };
}

async function loadSplit(supabase: ReturnType<typeof createAdminSupabase>, splitId: string) {
  const { data, error } = await (supabase as any).from('account_splits').select('*').eq('id', splitId).maybeSingle();
  if (error || !data) return null;
  return data as {
    id: string;
    created_by_profile_id: string;
    payer_profile_id: string;
    total_amount: number;
    reason: string;
    place: string | null;
  };
}

function canManageSplit(
  userId: string,
  split: { created_by_profile_id: string },
  isAdmin: boolean,
): boolean {
  return isAdmin || split.created_by_profile_id === userId;
}

export async function PATCH(req: NextRequest, { params }: { params: { splitId: string } }) {
  const splitId = params.splitId?.trim();
  if (!splitId) return NextResponse.json({ error: 'Missing split id' }, { status: 400 });

  const auth = await requireUser();
  if ('error' in auth && auth.error) return auth.error;
  const { user, cookieStore, userClient } = auth as {
    user: { id: string };
    cookieStore: Awaited<ReturnType<typeof cookies>>;
    userClient: ReturnType<typeof createRouteHandlerClient<Database>>;
  };

  let body: { reason?: string; place?: string; totalAmount?: number } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const reason = (body.reason ?? '').trim().slice(0, 300);
  if (!reason) return NextResponse.json({ error: 'Reason is required.' }, { status: 400 });

  const place = (body.place ?? '').trim().slice(0, 200) || null;
  const totalAmount =
    typeof body.totalAmount === 'number' ? body.totalAmount : parseFloat(String(body.totalAmount ?? ''));
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return NextResponse.json({ error: 'Enter a valid amount greater than 0.' }, { status: 400 });
  }

  try {
    const supabase = createAdminSupabase();
    const split = await loadSplit(supabase, splitId);
    if (!split) return NextResponse.json({ error: 'Split not found' }, { status: 404 });

    let isAdmin = cookieStore.get('pirates_admin')?.value === 'true';
    if (!isAdmin) {
      const { data: prof } = await userClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
      isAdmin = (prof as { role?: string } | null)?.role === 'admin';
    }
    if (!canManageSplit(user.id, split, isAdmin)) {
      return NextResponse.json({ error: 'Only the person who added this split can edit it.' }, { status: 403 });
    }

    const { data: shares } = await (supabase as any)
      .from('account_split_shares')
      .select('id, participant_profile_id, paid')
      .eq('split_id', splitId);
    const shareRows = (shares ?? []) as { id: string; participant_profile_id: string; paid: boolean }[];
    if (shareRows.length < 1) {
      return NextResponse.json({ error: 'Split has no participants.' }, { status: 400 });
    }

    const amounts = equalShareAmounts(totalAmount, shareRows.length);

    const { error: splitErr } = await (supabase as any)
      .from('account_splits')
      .update({ reason, place, total_amount: totalAmount })
      .eq('id', splitId);
    if (splitErr) return NextResponse.json({ error: splitErr.message }, { status: 400 });

    for (let i = 0; i < shareRows.length; i++) {
      const sh = shareRows[i]!;
      const { error: shErr } = await (supabase as any)
        .from('account_split_shares')
        .update({ share_amount: amounts[i] ?? 0 })
        .eq('id', sh.id);
      if (shErr) return NextResponse.json({ error: shErr.message }, { status: 400 });
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

export async function DELETE(_req: NextRequest, { params }: { params: { splitId: string } }) {
  const splitId = params.splitId?.trim();
  if (!splitId) return NextResponse.json({ error: 'Missing split id' }, { status: 400 });

  const auth = await requireUser();
  if ('error' in auth && auth.error) return auth.error;
  const { user, cookieStore, userClient } = auth as {
    user: { id: string };
    cookieStore: Awaited<ReturnType<typeof cookies>>;
    userClient: ReturnType<typeof createRouteHandlerClient<Database>>;
  };

  try {
    const supabase = createAdminSupabase();
    const split = await loadSplit(supabase, splitId);
    if (!split) return NextResponse.json({ error: 'Split not found' }, { status: 404 });

    let isAdmin = cookieStore.get('pirates_admin')?.value === 'true';
    if (!isAdmin) {
      const { data: prof } = await userClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
      isAdmin = (prof as { role?: string } | null)?.role === 'admin';
    }
    if (!canManageSplit(user.id, split, isAdmin)) {
      return NextResponse.json({ error: 'Only the person who added this split can delete it.' }, { status: 403 });
    }

    const { error: delErr } = await (supabase as any).from('account_splits').delete().eq('id', splitId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

    try {
      revalidatePath('/accounts');
      revalidatePath('/profiles');
    } catch {
      /* ignore */
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Delete failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

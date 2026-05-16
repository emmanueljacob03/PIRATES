import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { equalShareAmounts } from '@/lib/account-splits';
import type { Database } from '@/types/database';

type ShareRow = {
  id: string;
  split_id: string;
  participant_profile_id: string;
  share_amount: number;
  paid: boolean;
};

type SplitRow = {
  id: string;
  reason: string;
  place: string | null;
  total_amount: number;
  payer_profile_id: string;
  created_by_profile_id: string;
  split_date: string;
  created_at: string;
};

async function requireSessionUser() {
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
  return { user, cookieStore };
}

export async function GET() {
  const auth = await requireSessionUser();
  if ('error' in auth && auth.error) return auth.error;
  const { user } = auth as { user: { id: string } };

  try {
    const supabase = createAdminSupabase();

    const { data: players } = await (supabase as any)
      .from('players')
      .select('id, name, profile_id')
      .not('profile_id', 'is', null)
      .order('name');

    const profileIds = Array.from(
      new Set((players ?? []).map((p: { profile_id: string }) => p.profile_id).filter(Boolean)),
    );

    const profileNameById = new Map<string, string>();
    if (profileIds.length > 0) {
      const { data: profs } = await (supabase as any)
        .from('profiles')
        .select('id, name, email')
        .in('id', profileIds);
      for (const p of profs ?? []) {
        const row = p as { id: string; name: string | null; email: string | null };
        profileNameById.set(row.id, (row.name || row.email || 'Member').trim());
      }
    }

    const roster = (players ?? []).map((p: { id: string; name: string; profile_id: string }) => ({
      playerId: p.id,
      profileId: p.profile_id,
      name: profileNameById.get(p.profile_id) || p.name || 'Member',
    }));

    const { data: myShares } = await (supabase as any)
      .from('account_split_shares')
      .select(
        'id, split_id, participant_profile_id, share_amount, paid, account_splits(id, reason, place, total_amount, payer_profile_id, created_by_profile_id, split_date, created_at)',
      )
      .eq('participant_profile_id', user.id)
      .order('created_at', { ascending: false });

    const { data: createdSplits } = await (supabase as any)
      .from('account_splits')
      .select('*')
      .eq('created_by_profile_id', user.id)
      .order('created_at', { ascending: false });

    const splitIds = (createdSplits ?? []).map((s: SplitRow) => s.id);
    let sharesBySplit = new Map<string, ShareRow[]>();
    if (splitIds.length > 0) {
      const { data: allShares } = await (supabase as any)
        .from('account_split_shares')
        .select('*')
        .in('split_id', splitIds);
      for (const sh of allShares ?? []) {
        const row = sh as ShareRow;
        const list = sharesBySplit.get(row.split_id) ?? [];
        list.push(row);
        sharesBySplit.set(row.split_id, list);
      }
    }

    const created = (createdSplits ?? []).map((s: SplitRow) => ({
      ...s,
      payerName: profileNameById.get(s.payer_profile_id) ?? 'Member',
      shares: (sharesBySplit.get(s.id) ?? []).map((sh) => ({
        ...sh,
        participantName: profileNameById.get(sh.participant_profile_id) ?? 'Member',
      })),
    }));

    const owedToMe = await loadOwedToUser(supabase, user.id, profileNameById);

    const myEntries = (myShares ?? []).map(
      (row: ShareRow & { account_splits: SplitRow | SplitRow[] }) => {
        const split = Array.isArray(row.account_splits) ? row.account_splits[0] : row.account_splits;
        const payerName = split ? profileNameById.get(split.payer_profile_id) ?? 'Member' : 'Member';
        return {
          shareId: row.id,
          amount: Number(row.share_amount),
          paid: row.paid,
          reason: split?.reason ?? '',
          place: split?.place ?? null,
          splitDate: split?.split_date ?? '',
          payerName,
          payerProfileId: split?.payer_profile_id ?? '',
          isPayer: split?.payer_profile_id === user.id,
        };
      },
    );

    return NextResponse.json({ roster, created, myEntries, owedToMe });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load accounts';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function loadOwedToUser(
  supabase: ReturnType<typeof createAdminSupabase>,
  userId: string,
  profileNameById: Map<string, string>,
) {
  const { data: mySplits } = await (supabase as any)
    .from('account_splits')
    .select('id')
    .eq('payer_profile_id', userId);
  const ids = (mySplits ?? []).map((s: { id: string }) => s.id);
  if (ids.length === 0) return [];

  const { data: shares } = await (supabase as any)
    .from('account_split_shares')
    .select(
      'id, participant_profile_id, share_amount, paid, account_splits(reason, place, split_date)',
    )
    .in('split_id', ids)
    .neq('participant_profile_id', userId)
    .eq('paid', false);

  return (shares ?? []).map(
    (row: ShareRow & { account_splits: { reason: string; place: string | null; split_date: string } }) => {
      const split = Array.isArray(row.account_splits) ? row.account_splits[0] : row.account_splits;
      return {
        shareId: row.id,
        amount: Number(row.share_amount),
        fromName: profileNameById.get(row.participant_profile_id) ?? 'Member',
        reason: split?.reason ?? '',
        place: split?.place ?? null,
        splitDate: split?.split_date ?? '',
      };
    },
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireSessionUser();
  if ('error' in auth && auth.error) return auth.error;
  const { user } = auth as { user: { id: string } };

  let body: {
    participantProfileIds?: string[];
    totalAmount?: number;
    reason?: string;
    place?: string;
    splitDate?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const reason = (body.reason ?? '').trim().slice(0, 300);
  if (!reason) {
    return NextResponse.json({ error: 'Reason is required (what you spent on).' }, { status: 400 });
  }

  const place = (body.place ?? '').trim().slice(0, 200) || null;
  const totalAmount =
    typeof body.totalAmount === 'number' ? body.totalAmount : parseFloat(String(body.totalAmount ?? ''));
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return NextResponse.json({ error: 'Enter a valid amount greater than 0.' }, { status: 400 });
  }

  const participantIds = Array.from(
    new Set(
      (body.participantProfileIds ?? []).filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  );
  if (participantIds.length < 1) {
    return NextResponse.json({ error: 'Select at least one player to split with.' }, { status: 400 });
  }

  if (!participantIds.includes(user.id)) {
    participantIds.push(user.id);
  }

  const splitDate = (body.splitDate ?? new Date().toISOString().slice(0, 10)).toString().slice(0, 10);

  try {
    const supabase = createAdminSupabase();
    const shares = equalShareAmounts(totalAmount, participantIds.length);

    const { data: split, error: splitErr } = await (supabase as any)
      .from('account_splits')
      .insert({
        reason,
        place,
        total_amount: totalAmount,
        payer_profile_id: user.id,
        created_by_profile_id: user.id,
        split_date: splitDate,
      })
      .select()
      .single();

    if (splitErr || !split) {
      return NextResponse.json({ error: splitErr?.message ?? 'Could not create split' }, { status: 400 });
    }

    const shareRows = participantIds.map((participant_profile_id, i) => ({
      split_id: split.id,
      participant_profile_id,
      share_amount: shares[i] ?? 0,
      paid: participant_profile_id === user.id,
      paid_at: participant_profile_id === user.id ? new Date().toISOString() : null,
    }));

    const { error: sharesErr } = await (supabase as any).from('account_split_shares').insert(shareRows);
    if (sharesErr) {
      await (supabase as any).from('account_splits').delete().eq('id', split.id);
      return NextResponse.json({ error: sharesErr.message }, { status: 400 });
    }

    try {
      revalidatePath('/accounts');
      revalidatePath('/profiles');
    } catch {
      /* ignore */
    }

    return NextResponse.json({ ok: true, splitId: split.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create split';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

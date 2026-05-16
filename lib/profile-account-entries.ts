import { createAdminSupabase } from '@/lib/supabase-admin';
import { isPaid } from '@/lib/is-paid';

export type ProfileAccountEntry = {
  shareId: string;
  payerName: string;
  amount: number;
  reason: string;
  place: string | null;
  splitDate: string;
  /** When the split was recorded (share row created_at). */
  recordedAt: string | null;
  paid: boolean;
};

/** Shares on this profile where someone else paid and this user is in the split. */
export async function loadProfileAccountEntries(userId: string): Promise<ProfileAccountEntry[]> {
  try {
    const supabase = createAdminSupabase();

    const { data: rows, error } = await (supabase as any)
      .from('account_split_shares')
      .select(
        'id, share_amount, paid, created_at, account_splits(reason, place, split_date, created_at, payer_profile_id)',
      )
      .eq('participant_profile_id', userId)
      .order('created_at', { ascending: false });

    if (error || !rows?.length) return [];

    const payerIds = new Set<string>();
    for (const row of rows) {
      const split = Array.isArray(row.account_splits) ? row.account_splits[0] : row.account_splits;
      if (split?.payer_profile_id && split.payer_profile_id !== userId) {
        payerIds.add(split.payer_profile_id);
      }
    }

    const payerNameById = new Map<string, string>();
    if (payerIds.size > 0) {
      const { data: profs } = await (supabase as any)
        .from('profiles')
        .select('id, name, email')
        .in('id', Array.from(payerIds));
      for (const p of profs ?? []) {
        const pr = p as { id: string; name: string | null; email: string | null };
        payerNameById.set(pr.id, (pr.name || pr.email || 'Member').trim());
      }
    }

    const entries: ProfileAccountEntry[] = [];
    for (const row of rows) {
      const split = Array.isArray(row.account_splits) ? row.account_splits[0] : row.account_splits;
      if (!split || split.payer_profile_id === userId) continue;

      const shareCreated = (row as { created_at?: string | null }).created_at ?? null;
      const splitCreated = (split as { created_at?: string | null }).created_at ?? null;
      entries.push({
        shareId: row.id,
        payerName: payerNameById.get(split.payer_profile_id) ?? 'Member',
        amount: Number(row.share_amount),
        reason: split.reason ?? '',
        place: split.place ?? null,
        splitDate: split.split_date ?? '',
        recordedAt: shareCreated || splitCreated || null,
        paid: isPaid(row.paid),
      });
    }

    return entries;
  } catch {
    return [];
  }
}

export function pendingAccountTotal(entries: ProfileAccountEntry[]): number {
  return entries.filter((e) => !e.paid).reduce((s, e) => s + e.amount, 0);
}

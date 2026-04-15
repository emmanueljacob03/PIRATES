import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import JerseysPageClient from '@/components/JerseysPageClient';
import type { Jersey } from '@/types/database';
import { sortJerseysByNumber, type JerseyRow } from '@/lib/jersey-utils';
import { legacyJerseySubmitterProfileId } from '@/lib/jersey-legacy-account';

export default async function JerseysPage() {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('pirates_admin')?.value === 'true';
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';
  let jerseys: JerseyRow[] = [];
  let currentUserId: string | null = null;
  try {
    const userSupabase = await createServerSupabase();
    const {
      data: { user },
    } = await userSupabase.auth.getUser();
    currentUserId = user?.id ?? null;
    const supabase = codeVerified ? createAdminSupabase() : userSupabase;
    const [{ data }, { data: allProfs }, { data: allPlayers }] = await Promise.all([
      (supabase as any).from('jerseys').select('*'),
      (supabase as any).from('profiles').select('id, name'),
      (supabase as any).from('players').select('name, profile_id'),
    ]);
    const rows = (data ?? []) as Jersey[];
    const profilesForInfer = (allProfs ?? []) as { id: string; name: string | null }[];
    const playersForInfer = (allPlayers ?? []) as { name: string | null; profile_id: string | null }[];
    const profileNameById: Record<string, string> = {};
    for (const p of profilesForInfer) {
      if (p?.id) profileNameById[p.id] = (p.name ?? '').trim();
    }
    jerseys = rows
      .map((r) => {
        const sid = r.submitted_by_id ?? legacyJerseySubmitterProfileId(r.player_name, playersForInfer);
        const submitterName = sid ? profileNameById[sid] || null : null;
        return {
          ...r,
          jersey_number: String(r.jersey_number ?? ''),
          submitter_name: submitterName,
          inferred_submitted_by_id: sid,
        };
      })
      .sort(sortJerseysByNumber);
  } catch {
    jerseys = [];
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-pirate-gold mb-6">Jerseys</h2>
      <JerseysPageClient initial={jerseys} isAdmin={isAdmin} currentUserId={currentUserId} />
    </div>
  );
}

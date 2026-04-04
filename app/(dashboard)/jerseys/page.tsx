import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import JerseysPageClient from '@/components/JerseysPageClient';
import type { Jersey } from '@/types/database';
import { sortJerseysByNumber, type JerseyRow } from '@/lib/jersey-utils';
import { uniqueInferredProfileFullNameForLegacyFormName } from '@/lib/name-match';

export default async function JerseysPage() {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('pirates_admin')?.value === 'true';
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';
  let jerseys: JerseyRow[] = [];
  try {
    const supabase = codeVerified ? createAdminSupabase() : await createServerSupabase();
    const [{ data }, { data: allProfs }, { data: allPlayers }] = await Promise.all([
      (supabase as any).from('jerseys').select('*'),
      (supabase as any).from('profiles').select('id, name'),
      (supabase as any).from('players').select('name, profile_id'),
    ]);
    const rows = (data ?? []) as Jersey[];
    const profilesForInfer = (allProfs ?? []) as { id: string; name: string | null }[];
    const playersForInfer = (allPlayers ?? []) as { name: string | null; profile_id: string | null }[];
    const submitterIds = Array.from(
      new Set(rows.map((r) => r.submitted_by_id).filter((id): id is string => !!id)),
    );
    const nameById: Record<string, string> = {};
    if (submitterIds.length > 0) {
      const { data: profs } = await (supabase as any).from('profiles').select('id, name').in('id', submitterIds);
      for (const p of profs ?? []) {
        const row = p as { id: string; name: string | null };
        if (row?.id) nameById[row.id] = (row.name ?? '').trim();
      }
    }
    jerseys = rows
      .map((r) => {
        let submitterName = r.submitted_by_id ? nameById[r.submitted_by_id] ?? null : null;
        if (!submitterName && !r.submitted_by_id) {
          submitterName = uniqueInferredProfileFullNameForLegacyFormName(
            r.player_name,
            profilesForInfer,
            playersForInfer,
          );
        }
        return {
          ...r,
          jersey_number: String(r.jersey_number ?? ''),
          submitter_name: submitterName,
        };
      })
      .sort(sortJerseysByNumber);
  } catch {
    jerseys = [];
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-pirate-gold mb-6">Jerseys</h2>
      <JerseysPageClient initial={jerseys} isAdmin={isAdmin} />
    </div>
  );
}

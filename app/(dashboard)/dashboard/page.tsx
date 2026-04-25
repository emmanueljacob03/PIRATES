import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import DashboardMetrics, { type DashboardMvp } from '@/components/DashboardMetrics';
import { matchStatRowFromDb, sumCategoryPointsAcrossRows } from '@/lib/cricket-points';
import { playerPhotoUrl, scorecardDisplayName } from '@/lib/player-display-name';
import UmpiringDuties from '@/components/UmpiringDuties';
import TotalPendingCard from '@/components/TotalPendingCard';
import Playing11Widget from '@/components/Playing11Widget';
import {
  normalizeNameForMatch,
  uniqueInferredProfileFullNameForLegacyFormName,
  uniqueInferredProfileIdForLegacyFormName,
} from '@/lib/name-match';
import { legacyJerseySubmitterProfileId } from '@/lib/jersey-legacy-account';
import { NEW_JERSEY_AMOUNT_USD } from '@/lib/jersey-utils';
import { unstable_noStore as noStore } from 'next/cache';
import { readDesiredCollectionValue } from '@/lib/desired-collection';
import { isPracticeOpponent } from '@/lib/match-opponent';
import { isPaid } from '@/lib/is-paid';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  noStore();
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('pirates_admin')?.value === 'true';
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';
  const dashboardMode = isAdmin ? 'admin' : 'viewer';

  let totalPlayers = 0;
  let totalMatches = 0;
  let regularMatches = 0;
  let practiceMatches = 0;
  let mvp: DashboardMvp | null = null;
  let desiredCollectionsInitial = '0.00';
  let pendingByPlayer: { name: string; jersey: number; contribution: number; total: number }[] = [];

  try {
    desiredCollectionsInitial = await readDesiredCollectionValue();
  } catch {
    desiredCollectionsInitial = '0.00';
  }

  const supabase = codeVerified ? createAdminSupabase() : await createServerSupabase();
  try {
    const [playersRes, matchRowsRes, statsRes, jerseysRes, contribsRes] = await Promise.all([
      (supabase as any).from('players').select('id', { count: 'exact', head: true }),
      (supabase as any).from('matches').select('opponent'),
      (supabase as any).from('match_stats').select('*'),
      isAdmin
        ? createAdminSupabase().from('jerseys').select('player_name, paid, submitted_by_id')
        : Promise.resolve({ data: [] }),
      isAdmin
        ? createAdminSupabase().from('contributions').select('player_name, amount, paid, submitted_by_id')
        : Promise.resolve({ data: [] }),
    ]);
    totalPlayers = playersRes.count ?? 0;
    const matchRows = (matchRowsRes.data ?? []) as { opponent?: string }[];
    totalMatches = matchRows.length;
    practiceMatches = matchRows.filter((r) => isPracticeOpponent(r.opponent)).length;
    regularMatches = totalMatches - practiceMatches;
    type StatRow = Record<string, unknown> & { player_id: string };
    const stats = (statsRes.data ?? []) as StatRow[];
    const groups = new Map<string, StatRow[]>();
    stats.forEach((s) => {
      const id = s.player_id;
      const list = groups.get(id) ?? [];
      list.push(s);
      groups.set(id, list);
    });
    const contenders: { id: string; pts: number }[] = [];
    groups.forEach((rows, id) => {
      const pts = sumCategoryPointsAcrossRows(rows.map((r) => matchStatRowFromDb(r))).total;
      contenders.push({ id, pts });
    });
    contenders.sort((a, b) => b.pts - a.pts || a.id.localeCompare(b.id));
    const topId = contenders.length > 0 && contenders[0].pts > 0 ? contenders[0].id : null;
    if (topId != null) {
      const { data: player } = await supabase
        .from('players')
        .select('name, photo, profile_id')
        .eq('id', topId)
        .single();
      const pl = player as {
        name?: string;
        photo?: string | null;
        profile_id?: string | null;
      } | null;
      if (pl?.name != null || pl?.profile_id) {
        let profName: string | null = null;
        let profAvatar: string | null = null;
        if (pl.profile_id) {
          const { data: pr } = await supabase
            .from('profiles')
            .select('name, avatar_url')
            .eq('id', pl.profile_id)
            .maybeSingle();
          const row = pr as { name: string | null; avatar_url: string | null } | null;
          profName = row?.name ?? null;
          profAvatar = row?.avatar_url ?? null;
        }
        const name = scorecardDisplayName(pl.name ?? '', profName, pl.profile_id ?? null);
        if (name && name !== 'Unknown') {
          mvp = { name, photoUrl: playerPhotoUrl(pl.photo ?? null, profAvatar) };
        }
      }
    }
    if (isAdmin && jerseysRes.data != null && contribsRes.data != null) {
      type JRow = { player_name?: string; paid?: boolean; submitted_by_id?: string | null };
      type CRow = { player_name?: string; amount?: number; paid?: boolean; submitted_by_id?: string | null };
      /** Same unpaid rule as profiles; drop paid rows even if filter/encoding differs in PostgREST. */
      const jerseyRows = (jerseysRes.data as JRow[]).filter((j) => !isPaid(j.paid));
      const contribRows = (contribsRes.data as CRow[]).filter((c) => !isPaid(c.paid));
      const oweIds = new Set<string>();
      jerseyRows.forEach((j) => {
        if (j.submitted_by_id) oweIds.add(j.submitted_by_id);
      });
      contribRows.forEach((c) => {
        if (c.submitted_by_id) oweIds.add(c.submitted_by_id);
      });
      const displayByUserId: Record<string, string> = {};
      const oweIdList = Array.from(oweIds);
      if (oweIdList.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, name').in('id', oweIdList);
        for (const p of profs ?? []) {
          const row = p as { id: string; name: string | null };
          if (row?.id) displayByUserId[row.id] = (row.name ?? '').trim() || row.id;
        }
      }
      const { data: allProfsRaw } = await supabase.from('profiles').select('id, name');
      const { data: allPlayersRaw } = await supabase.from('players').select('name, profile_id');
      const profilesForInfer = (allProfsRaw ?? []) as { id: string; name: string | null }[];
      const playersForInfer = (allPlayersRaw ?? []) as { name: string | null; profile_id: string | null }[];
      const profileIdToName: Record<string, string> = {};
      for (const p of profilesForInfer) {
        if (p?.id) profileIdToName[p.id] = (p.name ?? '').trim() || p.id;
      }
      const legacyOweName = (formName: string | undefined): string => {
        const trimmed = (formName ?? '').trim();
        const inferred = uniqueInferredProfileFullNameForLegacyFormName(
          trimmed || null,
          profilesForInfer,
          playersForInfer,
        );
        return inferred || trimmed;
      };
      /** Stable bucket = one person: profile id when known; else normalized legacy label (never mix pid vs string display names). */
      const displayForProfileId = (id: string): string =>
        profileIdToName[id] || displayByUserId[id] || id;
      const jerseyBucket = (j: JRow): { key: string; display: string } => {
        if (j.submitted_by_id) {
          const id = j.submitted_by_id;
          return { key: `pid:${id}`, display: displayForProfileId(id) };
        }
        const rosterPid = legacyJerseySubmitterProfileId(j.player_name, playersForInfer);
        if (rosterPid) {
          return { key: `pid:${rosterPid}`, display: displayForProfileId(rosterPid) };
        }
        const label = legacyOweName(j.player_name);
        const nk = `legacy:${normalizeNameForMatch(label)}`;
        return { key: nk, display: label.trim() || nk };
      };
      const contribBucket = (c: CRow): { key: string; display: string } => {
        if (c.submitted_by_id) {
          const id = c.submitted_by_id;
          return { key: `pid:${id}`, display: displayForProfileId(id) };
        }
        const inferredPid = uniqueInferredProfileIdForLegacyFormName(
          (c.player_name ?? '').trim() || null,
          profilesForInfer,
          playersForInfer,
        );
        if (inferredPid) {
          return { key: `pid:${inferredPid}`, display: displayForProfileId(inferredPid) };
        }
        const label = legacyOweName(c.player_name);
        const nk = `legacy:${normalizeNameForMatch(label)}`;
        return { key: nk, display: label.trim() || nk };
      };
      const displayForBucket = new Map<string, string>();
      const pickBetterDisplay = (key: string, candidate: string) => {
        const c = candidate.trim();
        if (!c) return;
        const prev = displayForBucket.get(key);
        if (!prev || c.length > prev.length) displayForBucket.set(key, c);
      };
      const jerseyByBucket: Record<string, number> = {};
      jerseyRows.forEach((j) => {
        const { key, display } = jerseyBucket(j);
        if (!key) return;
        pickBetterDisplay(key, display);
        jerseyByBucket[key] = (jerseyByBucket[key] ?? 0) + NEW_JERSEY_AMOUNT_USD;
      });
      const contribByBucket: Record<string, number> = {};
      contribRows.forEach((c) => {
        const { key, display } = contribBucket(c);
        if (!key) return;
        pickBetterDisplay(key, display);
        contribByBucket[key] = (contribByBucket[key] ?? 0) + Number(c.amount ?? 0);
      });
      const bucketKeys = new Set([...Object.keys(jerseyByBucket), ...Object.keys(contribByBucket)]);
      pendingByPlayer = Array.from(bucketKeys)
        .map((key) => {
          const jersey = jerseyByBucket[key] ?? 0;
          const contribution = contribByBucket[key] ?? 0;
          const name = displayForBucket.get(key) ?? key.replace(/^pid:/, '').replace(/^legacy:/, '');
          return { name, jersey, contribution, total: jersey + contribution };
        })
        .filter((p) => p.total > 0)
        .sort((a, b) => b.total - a.total);
    }
  } catch {
    // use defaults
  }

  let umpiringRoster: { id: string; name: string }[] = [];
  try {
    if (codeVerified) {
      const sup = createAdminSupabase();
      const { data: rosterRows } = await sup.from('players').select('id, name').order('name');
      umpiringRoster = (rosterRows ?? []).map((p: { id: string; name: string | null }) => ({
        id: p.id,
        name: (p.name ?? '').trim() || 'Player',
      }));
    }
  } catch {
    umpiringRoster = [];
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-pirate-gold mb-6">Home</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 [&>*]:min-w-0">
        <DashboardMetrics
          totalPlayers={totalPlayers}
          desiredCollectionsInitial={desiredCollectionsInitial}
          totalMatches={totalMatches}
          regularMatches={regularMatches}
          practiceMatches={practiceMatches}
          mvp={mvp}
          isAdmin={isAdmin}
        />
        {isAdmin && <TotalPendingCard pendingByPlayer={pendingByPlayer} />}
        <Playing11Widget isAdmin={isAdmin} variant="metrics" />
      </div>
      <UmpiringDuties canEdit={isAdmin} roster={umpiringRoster} />
    </div>
  );
}

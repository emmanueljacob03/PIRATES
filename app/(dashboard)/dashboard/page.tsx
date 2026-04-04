import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import DashboardMetrics, { type DashboardMvp } from '@/components/DashboardMetrics';
import { matchStatRowFromDb, sumCategoryPointsAcrossRows } from '@/lib/cricket-points';
import { playerPhotoUrl, scorecardDisplayName } from '@/lib/player-display-name';
import UmpiringDuties from '@/components/UmpiringDuties';
import TotalPendingCard from '@/components/TotalPendingCard';
import Playing11Widget from '@/components/Playing11Widget';
import { uniqueInferredProfileFullNameForLegacyFormName } from '@/lib/name-match';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('pirates_admin')?.value === 'true';
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';
  const dashboardMode = isAdmin ? 'admin' : 'viewer';

  let totalPlayers = 0;
  let totalMatches = 0;
  let mvp: DashboardMvp | null = null;
  let desiredCollectionsInitial = '0.00';
  let pendingByPlayer: { name: string; jersey: number; contribution: number; total: number }[] = [];

  const supabase = codeVerified ? createAdminSupabase() : await createServerSupabase();
  try {
    const [playersRes, matchesRes, statsRes, jerseysRes, contribsRes] = await Promise.all([
      (supabase as any).from('players').select('id', { count: 'exact', head: true }),
      (supabase as any).from('matches').select('id', { count: 'exact', head: true }),
      (supabase as any).from('match_stats').select('*'),
      isAdmin
        ? (supabase as any).from('jerseys').select('player_name, paid, submitted_by_id')
        : Promise.resolve({ data: [] }),
      isAdmin
        ? (supabase as any).from('contributions').select('player_name, amount, paid, submitted_by_id')
        : Promise.resolve({ data: [] }),
    ]);
    totalPlayers = playersRes.count ?? 0;
    totalMatches = matchesRes.count ?? 0;
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
    if (isAdmin && jerseysRes.data && contribsRes.data) {
      type JRow = { player_name?: string; paid?: boolean; submitted_by_id?: string | null };
      type CRow = { player_name?: string; amount?: number; paid?: boolean; submitted_by_id?: string | null };
      const jerseyRows = (jerseysRes.data as JRow[]).filter((j) => !j.paid);
      const contribRows = (contribsRes.data as CRow[]).filter((c) => !c.paid);
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
      const legacyOweName = (formName: string | undefined): string => {
        const trimmed = (formName ?? '').trim();
        const inferred = uniqueInferredProfileFullNameForLegacyFormName(
          trimmed || null,
          profilesForInfer,
          playersForInfer,
        );
        return inferred || trimmed;
      };
      const oweKeyJersey = (j: JRow): string => {
        if (j.submitted_by_id) {
          return displayByUserId[j.submitted_by_id] || (j.player_name ?? '').trim();
        }
        return legacyOweName(j.player_name);
      };
      const oweKeyContrib = (c: CRow): string => {
        if (c.submitted_by_id) {
          return displayByUserId[c.submitted_by_id] || (c.player_name ?? '').trim();
        }
        return legacyOweName(c.player_name);
      };
      const jerseyByPerson: Record<string, number> = {};
      jerseyRows.forEach((j) => {
        const n = oweKeyJersey(j);
        if (n) jerseyByPerson[n] = (jerseyByPerson[n] ?? 0) + 50;
      });
      const contribByPerson: Record<string, number> = {};
      contribRows.forEach((c) => {
        const n = oweKeyContrib(c);
        if (n) contribByPerson[n] = (contribByPerson[n] ?? 0) + Number(c.amount ?? 0);
      });
      const names = new Set([...Object.keys(jerseyByPerson), ...Object.keys(contribByPerson)]);
      pendingByPlayer = Array.from(names).map((name) => {
        const jersey = jerseyByPerson[name] ?? 0;
        const contribution = contribByPerson[name] ?? 0;
        return { name, jersey, contribution, total: jersey + contribution };
      }).filter((p) => p.total > 0).sort((a, b) => b.total - a.total);
    }
  } catch {
    // use defaults
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 [&>*]:min-w-0">
        <DashboardMetrics
          totalPlayers={totalPlayers}
          desiredCollectionsInitial={desiredCollectionsInitial}
          totalMatches={totalMatches}
          mvp={mvp}
          isAdmin={isAdmin}
        />
        {isAdmin && <TotalPendingCard pendingByPlayer={pendingByPlayer} />}
        <Playing11Widget isAdmin={isAdmin} variant="metrics" />
      </div>
      <UmpiringDuties isAdmin={isAdmin} canEdit={isAdmin} />
    </div>
  );
}

import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import DashboardMetrics, { type DashboardMvp } from '@/components/DashboardMetrics';
import { matchStatRowFromDb, sumCategoryPointsAcrossRows } from '@/lib/cricket-points';
import UmpiringDuties from '@/components/UmpiringDuties';
import TotalPendingCard from '@/components/TotalPendingCard';
import Playing11Widget from '@/components/Playing11Widget';

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
      isAdmin ? (supabase as any).from('jerseys').select('player_name, paid') : Promise.resolve({ data: [] }),
      isAdmin ? (supabase as any).from('contributions').select('player_name, amount, paid') : Promise.resolve({ data: [] }),
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
        .select('name, photo')
        .eq('id', topId)
        .single();
      const pl = player as { name?: string; photo?: string | null } | null;
      if (pl?.name) {
        mvp = { name: pl.name, photoUrl: pl.photo ?? null };
      }
    }
    if (isAdmin && jerseysRes.data && contribsRes.data) {
      const jerseyByPerson: Record<string, number> = {};
      (jerseysRes.data as { player_name?: string; paid?: boolean }[]).filter((j) => !j.paid).forEach((j) => {
        const n = (j.player_name ?? '').trim();
        if (n) jerseyByPerson[n] = (jerseyByPerson[n] ?? 0) + 50;
      });
      const contribByPerson: Record<string, number> = {};
      (contribsRes.data as { player_name?: string; amount?: number; paid?: boolean }[]).filter((c) => !c.paid).forEach((c) => {
        const n = (c.player_name ?? '').trim();
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import DashboardMetrics from '@/components/DashboardMetrics';
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
  let mvp = '—';
  let desiredCollectionsInitial = '0.00';
  let pendingByPlayer: { name: string; jersey: number; contribution: number; total: number }[] = [];

  const supabase = codeVerified ? createAdminSupabase() : await createServerSupabase();
  try {
    const [playersRes, matchesRes, statsRes, jerseysRes, contribsRes] = await Promise.all([
      (supabase as any).from('players').select('id', { count: 'exact', head: true }),
      (supabase as any).from('matches').select('id', { count: 'exact', head: true }),
      (supabase as any).from('match_stats').select('player_id, runs, balls, wickets, catches, runouts, mvp'),
      isAdmin ? (supabase as any).from('jerseys').select('player_name, paid') : Promise.resolve({ data: [] }),
      isAdmin ? (supabase as any).from('contributions').select('player_name, amount, paid') : Promise.resolve({ data: [] }),
    ]);
    totalPlayers = playersRes.count ?? 0;
    totalMatches = matchesRes.count ?? 0;
    const stats = (statsRes.data ?? []) as { player_id: string; runs: number; wickets: number; catches: number; runouts: number; mvp: boolean }[];
    const pointsByPlayer: Record<string, number> = {};
    stats.forEach((s) => {
      const id = s.player_id;
      if (!pointsByPlayer[id]) pointsByPlayer[id] = 0;
      pointsByPlayer[id] += (s.runs ?? 0) + (s.wickets ?? 0) * 20 + (s.catches ?? 0) * 10 + (s.runouts ?? 0) * 10;
    });
    const mvpStat = stats.find((s) => s.mvp);
    if (mvpStat) {
      const { data: player } = await supabase.from('players').select('name').eq('id', mvpStat.player_id).single();
      mvp = (player as { name?: string } | null)?.name ?? '—';
    } else if (Object.keys(pointsByPlayer).length > 0) {
      const topId = Object.entries(pointsByPlayer).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (topId) {
        const { data: player } = await supabase.from('players').select('name').eq('id', topId).single();
        mvp = (player as { name?: string } | null)?.name ?? '—';
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

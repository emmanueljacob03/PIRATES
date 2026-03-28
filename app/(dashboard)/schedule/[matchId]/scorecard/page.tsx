import { notFound } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { format, parseISO } from 'date-fns';
import ScorecardForm from '@/components/ScorecardForm';
import { buildScorecardPlayersForMatch, sortStatsByLineup } from '@/lib/scorecard-lineup';

type ExistingStat = {
  id: string;
  player_id: string;
  runs: number;
  balls: number;
  fours?: number;
  sixes?: number;
  overs: number;
  wickets: number;
  runs_conceded: number;
  catches: number;
  runouts: number;
  mvp: boolean;
};

export default async function ScorecardPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('pirates_admin')?.value === 'true';
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';
  let match: { id: string; date: string; opponent: string } | null = null;
  let scorecardPlayers: { id: string; name: string }[] = [];
  let prefillPlayerIds: string[] | null = null;
  let existing: ExistingStat[] = [];
  let viewerOrderIds: string[] = [];

  try {
    const supabase = codeVerified ? createAdminSupabase() : await createServerSupabase();
    const { data: matchRow } = await supabase.from('matches').select('*').eq('id', matchId).single();
    if (!matchRow) notFound();
    match = matchRow as { id: string; date: string; opponent: string };

    const [{ data: playersData }, { data: lineupData }, { data: existingData }] = await Promise.all([
      supabase.from('players').select('id, name, profile_id').order('name'),
      supabase
        .from('match_playing11')
        .select('player_id, role, created_at')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true }),
      supabase.from('match_stats').select('*').eq('match_id', matchId),
    ]);

    const allPlayers = (playersData ?? []) as { id: string; name: string | null; profile_id: string | null }[];
    const profileIds = Array.from(
      new Set(allPlayers.map((p) => p.profile_id).filter((id): id is string => id != null && id !== '')),
    );
    let profilesByUserId = new Map<string, string | null>();
    if (profileIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, name').in('id', profileIds);
      profilesByUserId = new Map((profs ?? []).map((r: { id: string; name: string | null }) => [r.id, r.name]));
    }

    existing = (existingData ?? []) as ExistingStat[];
    const lineup = (lineupData ?? []).length > 0 ? (lineupData as { player_id: string; role: string; created_at: string }[]) : null;

    const existingPlayerIds = new Set(existing.map((e) => e.player_id));

    const built = buildScorecardPlayersForMatch({
      allPlayers,
      profilesByUserId,
      lineup,
      existingPlayerIds,
    });
    scorecardPlayers = built.players;
    prefillPlayerIds = built.prefillPlayerIds;
    viewerOrderIds = built.orderedIds;
  } catch {
    notFound();
  }

  if (!match) notFound();

  const matchDate = parseISO(match.date.slice(0, 10));
  const playerNameById = new Map(scorecardPlayers.map((p) => [p.id, p.name]));
  const sortedExisting = sortStatsByLineup(existing, viewerOrderIds);

  return (
    <div>
      <Link href="/schedule" className="text-amber-400 hover:underline text-sm mb-4 inline-block">← Back to Schedule</Link>
      <h2 className="text-2xl font-bold text-pirate-gold mb-2">Scorecard: {format(matchDate, 'MMMM d')} vs {match.opponent}</h2>
      <p className="text-slate-400 mb-6">
        {isAdmin ? 'Add or edit stats for this match.' : 'View match scorecard stats.'}
        {prefillPlayerIds && prefillPlayerIds.length > 0 && (
          <>
            {' '}
            <span className="text-slate-500">
              Playing XI + extras for this match are listed first; OCR matches these names (not emails).
            </span>
          </>
        )}
      </p>
      {isAdmin ? (
        <ScorecardForm
          matchId={matchId}
          players={scorecardPlayers}
          existingStats={existing}
          prefillPlayerIds={prefillPlayerIds}
          isAdmin={isAdmin}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-600">
                <th className="pb-2 pr-4">Player</th>
                <th className="pb-2 pr-2">Runs</th>
                <th className="pb-2 pr-2">Balls</th>
                <th className="pb-2 pr-2">4s</th>
                <th className="pb-2 pr-2">6s</th>
                <th className="pb-2 pr-2">Overs</th>
                <th className="pb-2 pr-2">Wickets</th>
                <th className="pb-2 pr-2">Runs conc.</th>
                <th className="pb-2 pr-2">Catches</th>
                <th className="pb-2 pr-2">Run outs</th>
                <th className="pb-2">MVP</th>
              </tr>
            </thead>
            <tbody>
              {sortedExisting.length === 0 ? (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={11}>No scorecard data yet.</td>
                </tr>
              ) : (
                sortedExisting.map((row) => (
                  <tr key={row.id} className="border-b border-slate-700/50">
                    <td className="py-2 pr-4 font-medium">
                      {playerNameById.get(row.player_id) ?? row.player_id}
                    </td>
                    <td className="py-2 pr-2">{row.runs ?? 0}</td>
                    <td className="py-2 pr-2">{row.balls ?? 0}</td>
                    <td className="py-2 pr-2">{row.fours ?? 0}</td>
                    <td className="py-2 pr-2">{row.sixes ?? 0}</td>
                    <td className="py-2 pr-2">{row.overs ?? 0}</td>
                    <td className="py-2 pr-2">{row.wickets ?? 0}</td>
                    <td className="py-2 pr-2">{row.runs_conceded ?? 0}</td>
                    <td className="py-2 pr-2">{row.catches ?? 0}</td>
                    <td className="py-2 pr-2">{row.runouts ?? 0}</td>
                    <td className="py-2">{row.mvp ? 'Yes' : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

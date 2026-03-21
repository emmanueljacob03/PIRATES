import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase-server';

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let player: { id: string; name: string; photo: string | null; jersey_number: number | null; role: string } | null = null;
  let totals = { runs: 0, balls: 0, overs: 0, wickets: 0, runs_conceded: 0, catches: 0, runouts: 0, mvpAwards: 0 };
  let matchesPlayed = 0;
  let highestScore = 0;
  let strikeRate = 0;
  let economy = 0;

  try {
    const supabase = await createServerSupabase();
    const { data: playerRow } = await supabase.from('players').select('*').eq('id', id).single();
    if (!playerRow) notFound();
    player = playerRow as { id: string; name: string; photo: string | null; jersey_number: number | null; role: string };

    const { data: statsData } = await supabase.from('match_stats').select('*').eq('player_id', id);
    type StatRow = { runs?: number; balls?: number; overs?: number; wickets?: number; runs_conceded?: number; catches?: number; runouts?: number; mvp?: boolean };
    const stats = (statsData ?? []) as StatRow[];

    type Totals = { runs: number; balls: number; overs: number; wickets: number; runs_conceded: number; catches: number; runouts: number; mvpAwards: number };
    const initial: Totals = { runs: 0, balls: 0, overs: 0, wickets: 0, runs_conceded: 0, catches: 0, runouts: 0, mvpAwards: 0 };
    totals = stats.reduce<Totals>(
      (acc, s) => ({
        runs: acc.runs + (s.runs ?? 0),
        balls: acc.balls + (s.balls ?? 0),
        overs: acc.overs + (s.overs ?? 0),
        wickets: acc.wickets + (s.wickets ?? 0),
        runs_conceded: acc.runs_conceded + (s.runs_conceded ?? 0),
        catches: acc.catches + (s.catches ?? 0),
        runouts: acc.runouts + (s.runouts ?? 0),
        mvpAwards: acc.mvpAwards + (s.mvp ? 1 : 0),
      }),
      initial
    );
    matchesPlayed = stats.length;
    strikeRate = totals.balls > 0 ? (totals.runs / totals.balls) * 100 : 0;
    economy = totals.overs > 0 ? totals.runs_conceded / totals.overs : 0;
    const highScoreRow = [...stats].sort((a, b) => (b.runs ?? 0) - (a.runs ?? 0))[0];
    highestScore = highScoreRow?.runs ?? 0;
  } catch {
    notFound();
  }

  if (!player) notFound();

  return (
    <div>
      <Link href="/players" className="text-amber-400 hover:underline text-sm mb-4 inline-block">← Back to Players</Link>
      <div className="card max-w-2xl">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="w-32 h-32 relative rounded-lg overflow-hidden bg-slate-700 flex-shrink-0">
            {player.photo ? (
              <Image src={player.photo} alt={player.name} fill className="object-cover" sizes="128px" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl">🏏</div>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{player.name}</h2>
            {player.jersey_number != null && <p className="text-pirate-gold">Jersey #{player.jersey_number}</p>}
            <p className="text-slate-400">Role: {player.role}</p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard label="Matches Played" value={String(matchesPlayed)} />
          <StatCard label="Total Runs" value={String(totals.runs)} />
          <StatCard label="Highest Score" value={String(highestScore)} />
          <StatCard label="Strike Rate" value={totals.balls > 0 ? strikeRate.toFixed(1) : '—'} />
          <StatCard label="Overs Bowled" value={String(totals.overs)} />
          <StatCard label="Wickets" value={String(totals.wickets)} />
          <StatCard label="Economy" value={totals.overs > 0 ? economy.toFixed(1) : '—'} />
          <StatCard label="Catches" value={String(totals.catches)} />
          <StatCard label="Run Outs" value={String(totals.runouts)} />
          <StatCard label="MVP Awards" value={String(totals.mvpAwards)} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-700/50 rounded-lg p-3">
      <p className="text-slate-400 text-xs">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

import { createServerSupabase } from '@/lib/supabase-server';
import LeaderboardView from '@/components/LeaderboardView';

type LeaderboardRow = {
  playerId: string;
  name: string;
  runs: number;
  balls: number;
  wickets: number;
  overs: number;
  runs_conceded: number;
  catches: number;
  runouts: number;
  strikeRate: number;
  economy: number;
  points: number;
};

const emptyLeaderboard: {
  bestBatsman: LeaderboardRow[];
  bestBowler: LeaderboardRow[];
  bestFielder: (LeaderboardRow & { fieldPoints: number })[];
  mvp: LeaderboardRow[];
} = {
  bestBatsman: [],
  bestBowler: [],
  bestFielder: [],
  mvp: [],
};

export default async function LeaderboardPage() {
  let data: typeof emptyLeaderboard = emptyLeaderboard;
  try {
    const supabase = await createServerSupabase();
    const { data: stats } = await supabase.from('match_stats').select('player_id, runs, balls, overs, wickets, runs_conceded, catches, runouts');
    const { data: players } = await supabase.from('players').select('id, name');

    type PlayerRow = { id: string; name: string };
    const playerMap = new Map(((players ?? []) as PlayerRow[]).map((p) => [p.id, p.name]));

    const agg: Record<string, { runs: number; balls: number; overs: number; wickets: number; runs_conceded: number; catches: number; runouts: number }> = {};
    const statsList = (stats ?? []) as { player_id: string; runs: number; balls: number; overs: number; wickets: number; runs_conceded: number; catches: number; runouts: number }[];
    statsList.forEach((s) => {
      const id = s.player_id;
      if (!agg[id]) agg[id] = { runs: 0, balls: 0, overs: 0, wickets: 0, runs_conceded: 0, catches: 0, runouts: 0 };
      agg[id].runs += s.runs ?? 0;
      agg[id].balls += s.balls ?? 0;
      agg[id].overs += s.overs ?? 0;
      agg[id].wickets += s.wickets ?? 0;
      agg[id].runs_conceded += s.runs_conceded ?? 0;
      agg[id].catches += s.catches ?? 0;
      agg[id].runouts += s.runouts ?? 0;
    });

    const withNames = Object.entries(agg).map(([playerId, a]) => ({
      playerId,
      name: playerMap.get(playerId) ?? 'Unknown',
      ...a,
      strikeRate: a.balls > 0 ? (a.runs / a.balls) * 100 : 0,
      economy: (() => {
        // Treat `overs` as cricket dot-overs (e.g. 1.1 = 1 over + 1 ball => 7 balls / 6 = 1.1667 real overs)
        if (!a.overs || a.overs <= 0) return 0;
        const wholeOvers = Math.floor(a.overs);
        const ballsDigitRaw = Math.round((a.overs - wholeOvers) * 10); // expected 0..5
        const ballsDigit = Math.max(0, Math.min(5, ballsDigitRaw));
        const totalBalls = wholeOvers * 6 + ballsDigit;
        const realOvers = totalBalls / 6;
        if (realOvers <= 0) return 0;
        return a.runs_conceded / realOvers;
      })(),
      // Scoring rules:
      // Batting: 3 points for every 10 runs
      // Bowling: 2 points per wicket
      // Fielding: 1 point per catch + 1 point per run out
      points: Math.floor(a.runs / 10) * 3 + a.wickets * 2 + a.catches * 1 + a.runouts * 1,
    }));

    data = {
      bestBatsman: [...withNames].sort((a, b) => b.runs - a.runs),
      bestBowler: [...withNames].sort((a, b) => b.wickets - a.wickets),
      bestFielder: [...withNames].map((p) => ({ ...p, fieldPoints: p.catches + p.runouts })).sort((a, b) => b.fieldPoints - a.fieldPoints),
      mvp: [...withNames].sort((a, b) => b.points - a.points),
    };
  } catch {
    data = emptyLeaderboard;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--pirate-yellow)' }}>Leaderboard</h2>
      <LeaderboardView
        bestBatsman={data.bestBatsman}
        bestBowler={data.bestBowler}
        bestFielder={data.bestFielder}
        mvp={data.mvp}
      />
    </div>
  );
}

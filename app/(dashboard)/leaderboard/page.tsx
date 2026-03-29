import { createServerSupabase } from '@/lib/supabase-server';
import LeaderboardView from '@/components/LeaderboardView';
import { matchStatRowFromDb, sumCategoryPointsAcrossRows } from '@/lib/cricket-points';
import { playerPhotoUrl, scorecardDisplayName } from '@/lib/player-display-name';

type LeaderboardRow = {
  playerId: string;
  name: string;
  photoUrl: string | null;
  runs: number;
  balls: number;
  wickets: number;
  overs: number;
  runs_conceded: number;
  catches: number;
  runouts: number;
  strikeRate: number;
  economy: number;
  battingPoints: number;
  bowlingPoints: number;
  fieldingPoints: number;
  points: number;
};

const emptyLeaderboard: {
  bestBatsman: LeaderboardRow[];
  bestBowler: LeaderboardRow[];
  bestFielder: LeaderboardRow[];
  mvp: LeaderboardRow[];
} = {
  bestBatsman: [],
  bestBowler: [],
  bestFielder: [],
  mvp: [],
};

function economyFromDotOversAgg(oversDotSum: number, runsConcededSum: number): number {
  if (!oversDotSum || oversDotSum <= 0) return 0;
  const wholeOvers = Math.floor(oversDotSum);
  const ballsDigitRaw = Math.round((oversDotSum - wholeOvers) * 10);
  const ballsDigit = Math.max(0, Math.min(5, ballsDigitRaw));
  const totalBalls = wholeOvers * 6 + ballsDigit;
  const realOvers = totalBalls / 6;
  if (realOvers <= 0) return 0;
  return runsConcededSum / realOvers;
}

export default async function LeaderboardPage() {
  let data: typeof emptyLeaderboard = emptyLeaderboard;
  try {
    const supabase = await createServerSupabase();
    const { data: stats } = await supabase.from('match_stats').select('*');
    const { data: players } = await supabase.from('players').select('id, name, photo, profile_id');

    type PlayerRow = {
      id: string;
      name: string;
      photo: string | null;
      profile_id: string | null;
    };
    const plist = (players ?? []) as PlayerRow[];
    const profileIds = Array.from(
      new Set(plist.map((p) => p.profile_id).filter((id): id is string => id != null && id !== '')),
    );
    const profileById = new Map<string, { name: string | null; avatar_url: string | null }>();
    if (profileIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', profileIds);
      for (const row of profs ?? []) {
        const r = row as { id: string; name: string | null; avatar_url: string | null };
        profileById.set(r.id, { name: r.name, avatar_url: r.avatar_url });
      }
    }
    const playerMap = new Map(
      plist.map((p) => {
        const pr = p.profile_id ? profileById.get(p.profile_id) : undefined;
        return [
          p.id,
          {
            ...p,
            displayName: scorecardDisplayName(p.name, pr?.name ?? null, p.profile_id),
            displayPhoto: playerPhotoUrl(p.photo, pr?.avatar_url ?? null),
          },
        ] as const;
      }),
    );

    type StatRow = Record<string, unknown> & { player_id: string };
    const statsList = (stats ?? []) as StatRow[];

    const groups = new Map<string, StatRow[]>();
    statsList.forEach((s) => {
      const id = s.player_id;
      const list = groups.get(id) ?? [];
      list.push(s);
      groups.set(id, list);
    });

    const withNames: LeaderboardRow[] = [];
    groups.forEach((rows, playerId) => {
      const p = playerMap.get(playerId);
      const name = p?.displayName ?? 'Unknown';
      const photoUrl = p?.displayPhoto ?? null;

      const pointsRows = rows.map((r) => matchStatRowFromDb(r));
      const pts = sumCategoryPointsAcrossRows(pointsRows);

      const a = rows.reduce(
        (acc, s) => ({
          runs: acc.runs + Number(s.runs ?? 0),
          balls: acc.balls + Number(s.balls ?? 0),
          overs: acc.overs + Number(s.overs ?? 0),
          wickets: acc.wickets + Number(s.wickets ?? 0),
          runs_conceded: acc.runs_conceded + Number(s.runs_conceded ?? 0),
          catches: acc.catches + Number(s.catches ?? 0),
          runouts: acc.runouts + Number(s.runouts ?? 0),
        }),
        { runs: 0, balls: 0, overs: 0, wickets: 0, runs_conceded: 0, catches: 0, runouts: 0 },
      );

      withNames.push({
        playerId,
        name,
        photoUrl,
        ...a,
        strikeRate: a.balls > 0 ? (a.runs / a.balls) * 100 : 0,
        economy: economyFromDotOversAgg(a.overs, a.runs_conceded),
        battingPoints: pts.batting,
        bowlingPoints: pts.bowling,
        fieldingPoints: pts.fielding,
        points: pts.total,
      });
    });

    const byBattingPts = (a: LeaderboardRow, b: LeaderboardRow) =>
      b.battingPoints !== a.battingPoints
        ? b.battingPoints - a.battingPoints
        : b.runs - a.runs || a.playerId.localeCompare(b.playerId);
    const byBowlingPts = (a: LeaderboardRow, b: LeaderboardRow) =>
      b.bowlingPoints !== a.bowlingPoints
        ? b.bowlingPoints - a.bowlingPoints
        : b.wickets - a.wickets || a.playerId.localeCompare(b.playerId);
    const byFieldingPts = (a: LeaderboardRow, b: LeaderboardRow) =>
      b.fieldingPoints !== a.fieldingPoints
        ? b.fieldingPoints - a.fieldingPoints
        : b.catches + b.runouts - (a.catches + a.runouts) || a.playerId.localeCompare(b.playerId);
    const byMvp = (a: LeaderboardRow, b: LeaderboardRow) =>
      b.points !== a.points ? b.points - a.points : a.playerId.localeCompare(b.playerId);

    data = {
      bestBatsman: [...withNames].filter((p) => p.runs > 0 || p.balls > 0 || p.battingPoints > 0).sort(byBattingPts),
      bestBowler: [...withNames].filter((p) => p.wickets > 0 || p.overs > 0 || p.bowlingPoints > 0).sort(byBowlingPts),
      bestFielder: [...withNames]
        .filter((p) => p.catches > 0 || p.runouts > 0 || p.fieldingPoints > 0)
        .sort(byFieldingPts),
      mvp: [...withNames].sort(byMvp),
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

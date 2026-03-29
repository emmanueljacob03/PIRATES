/**
 * Fantasy-style points per **single match** row (sum these across rows for season MVP).
 * Aligns scorecard live preview with leaderboard + dashboard.
 */

export type MatchStatPointsInput = {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  overs: number;
  maidens: number;
  wickets: number;
  runs_conceded: number;
  catches: number;
  runouts: number;
};

/** Dot overs: 2.2 = 2 overs + 2 balls → 14 balls → 14/6 legal overs. */
export function oversDotToLegalOvers(oversDot: number): number {
  if (!oversDot || oversDot <= 0) return 0;
  const whole = Math.floor(oversDot);
  const digit = Math.round((oversDot - whole) * 10);
  const ballsInPartial = Math.max(0, Math.min(5, digit));
  const totalBalls = whole * 6 + ballsInPartial;
  return totalBalls / 6;
}

export function economyFromDotOvers(oversDot: number, runsConceded: number): number {
  const legal = oversDotToLegalOvers(oversDot);
  if (legal <= 0) return 0;
  return runsConceded / legal;
}

/** Batting: volume + boundaries + milestones (common club fantasy style). */
export function battingPointsFromRow(s: MatchStatPointsInput): number {
  const runs = s.runs ?? 0;
  const fours = s.fours ?? 0;
  const sixes = s.sixes ?? 0;
  let pts = Math.floor(runs / 10) * 3 + fours * 2 + sixes * 3;
  if (runs >= 50) pts += 8;
  if (runs >= 100) pts += 15;
  if ((s.balls ?? 0) >= 1 && runs / s.balls >= 1.5) pts += 3;
  return Math.max(0, pts);
}

/** Bowling: wickets, maidens, economy tiers. */
export function bowlingPointsFromRow(s: MatchStatPointsInput): number {
  const w = s.wickets ?? 0;
  const m = s.maidens ?? 0;
  const rc = s.runs_conceded ?? 0;
  const oversDot = s.overs ?? 0;
  let pts = w * 6 + m * 4;
  const legal = oversDotToLegalOvers(oversDot);
  if (legal > 0 && w > 0) {
    const econ = rc / legal;
    if (econ <= 5) pts += 12;
    else if (econ <= 6) pts += 8;
    else if (econ <= 7) pts += 4;
    else if (econ >= 10) pts -= 4;
  }
  return Math.round(Math.max(0, pts) * 10) / 10;
}

/** Fielding: 3 pts per catch, 3 pts per run-out. */
export function fieldingPointsFromRow(s: MatchStatPointsInput): number {
  const c = s.catches ?? 0;
  const ro = s.runouts ?? 0;
  return Math.max(0, c * 3 + ro * 3);
}

export function totalPointsFromRow(s: MatchStatPointsInput): number {
  return (
    Math.round((battingPointsFromRow(s) + bowlingPointsFromRow(s) + fieldingPointsFromRow(s)) * 10) / 10
  );
}

/** Row from DB may omit include_* (legacy rows = all sections count). */
export type MatchStatRowForPoints = MatchStatPointsInput & {
  include_bat?: boolean;
  include_bowl?: boolean;
  include_field?: boolean;
};

export function battingPointsContributed(s: MatchStatRowForPoints): number {
  if (s.include_bat === false) return 0;
  return battingPointsFromRow(s);
}

export function bowlingPointsContributed(s: MatchStatRowForPoints): number {
  if (s.include_bowl === false) return 0;
  return bowlingPointsFromRow(s);
}

export function fieldingPointsContributed(s: MatchStatRowForPoints): number {
  if (s.include_field === false) return 0;
  return fieldingPointsFromRow(s);
}

export function totalPointsContributed(s: MatchStatRowForPoints): number {
  return (
    Math.round(
      (battingPointsContributed(s) + bowlingPointsContributed(s) + fieldingPointsContributed(s)) * 10,
    ) / 10
  );
}

/** Map a DB `match_stats` row for season aggregation. */
export function matchStatRowFromDb(s: Record<string, unknown>): MatchStatRowForPoints {
  const n = (v: unknown) => Number(v ?? 0);
  const b = (v: unknown) =>
    v === undefined || v === null ? undefined : Boolean(v);
  return {
    runs: n(s.runs),
    balls: n(s.balls),
    fours: n(s.fours),
    sixes: n(s.sixes),
    overs: n(s.overs),
    maidens: n(s.maidens),
    wickets: n(s.wickets),
    runs_conceded: n(s.runs_conceded),
    catches: n(s.catches),
    runouts: n(s.runouts),
    include_bat: b(s.include_bat),
    include_bowl: b(s.include_bowl),
    include_field: b(s.include_field),
  };
}

/** Sum per-match contributions (respects include_* flags when present). */
export function sumCategoryPointsAcrossRows(
  rows: MatchStatRowForPoints[],
): { batting: number; bowling: number; fielding: number; total: number } {
  let batting = 0;
  let bowling = 0;
  let fielding = 0;
  for (const r of rows) {
    batting += battingPointsContributed(r);
    bowling += bowlingPointsContributed(r);
    fielding += fieldingPointsContributed(r);
  }
  const total = Math.round((batting + bowling + fielding) * 10) / 10;
  return {
    batting: Math.round(batting * 10) / 10,
    bowling: Math.round(bowling * 10) / 10,
    fielding: Math.round(fielding * 10) / 10,
    total,
  };
}

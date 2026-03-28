import { scorecardDisplayName } from '@/lib/player-display-name';

export type ScorecardPlayerRow = { id: string; name: string };

type RawPlayer = { id: string; name: string | null; profile_id: string | null };
type ProfileRow = { id: string; name: string | null };

export function sortStatsByLineup<T extends { player_id: string }>(
  rows: T[],
  orderedPlayerIds: string[],
): T[] {
  const idx = new Map(orderedPlayerIds.map((id, i) => [id, i]));
  return [...rows].sort((a, b) => {
    const ia = idx.get(a.player_id);
    const ib = idx.get(b.player_id);
    if (ia !== undefined && ib !== undefined) return ia - ib;
    if (ia !== undefined) return -1;
    if (ib !== undefined) return 1;
    return 0;
  });
}

/**
 * Playing 11 + extras first (match order), then any other players with saved stats, then remaining roster by name.
 */
export function buildScorecardPlayersForMatch(args: {
  allPlayers: RawPlayer[];
  profilesByUserId: Map<string, string | null>;
  lineup: { player_id: string; role: string; created_at: string }[] | null;
  existingPlayerIds: Set<string>;
}): { players: ScorecardPlayerRow[]; prefillPlayerIds: string[] | null; orderedIds: string[] } {
  const { allPlayers, profilesByUserId, lineup, existingPlayerIds } = args;

  const byId = new Map(allPlayers.map((p) => [p.id, p]));

  const display = (p: RawPlayer) =>
    scorecardDisplayName(p.name, p.profile_id ? profilesByUserId.get(p.profile_id) ?? null : null, p.profile_id);

  if (!lineup || lineup.length === 0) {
    const sorted = [...allPlayers].sort((a, b) => display(a).localeCompare(display(b), undefined, { sensitivity: 'base' }));
    const players = sorted.map((p) => ({ id: p.id, name: display(p) }));
    return { players, prefillPlayerIds: null, orderedIds: players.map((p) => p.id) };
  }

  const byCreated = (a: (typeof lineup)[0], b: (typeof lineup)[0]) =>
    a.created_at.localeCompare(b.created_at) || a.player_id.localeCompare(b.player_id);
  const playing11 = lineup
    .filter((r) => r.role === 'playing11')
    .sort(byCreated)
    .map((r) => r.player_id);
  const extras = lineup
    .filter((r) => r.role === 'extra')
    .sort(byCreated)
    .map((r) => r.player_id);
  const lineupSet = new Set([...playing11, ...extras]);
  const fromStatsNotInLineup = Array.from(existingPlayerIds).filter((id) => !lineupSet.has(id));
  fromStatsNotInLineup.sort((a, b) => {
    const na = display(byId.get(a) ?? { id: a, name: null, profile_id: null });
    const nb = display(byId.get(b) ?? { id: b, name: null, profile_id: null });
    return na.localeCompare(nb, undefined, { sensitivity: 'base' });
  });

  const orderedIds = [...playing11, ...extras, ...fromStatsNotInLineup];

  const restIds = allPlayers.map((p) => p.id).filter((id) => !orderedIds.includes(id));
  restIds.sort((a, b) => {
    const na = display(byId.get(a)!);
    const nb = display(byId.get(b)!);
    return na.localeCompare(nb, undefined, { sensitivity: 'base' });
  });

  const finalIds = [...orderedIds, ...restIds];
  const players: ScorecardPlayerRow[] = finalIds
    .map((id) => {
      const p = byId.get(id);
      if (!p) return null;
      return { id: p.id, name: display(p) };
    })
    .filter((x): x is ScorecardPlayerRow => x != null);

  const prefillPlayerIds =
    playing11.length + extras.length > 0 ? [...playing11, ...extras] : null;

  return {
    players,
    prefillPlayerIds,
    orderedIds: finalIds,
  };
}

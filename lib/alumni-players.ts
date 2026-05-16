import { scorecardDisplayName } from '@/lib/player-display-name';

/** Normalize for loose name matching (handles trailing dots, extra spaces). */
export function normalizeNameForAlumniMatch(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Alumni roster — shown on Players page with a tag only; excluded from Playing 11,
 * scorecard edit, Accounts splits, umpiring picker, budget roster lists, etc.
 */
export function isAlumniDisplayName(name: string | null | undefined): boolean {
  const n = normalizeNameForAlumniMatch(name);
  if (!n) return false;
  if (n.includes('abhinav')) return true;
  if (n.includes('harsha') && n.includes('jampa')) return true;
  if (n.includes('venkata') && n.includes('narayana')) return true;
  return false;
}

export function isAlumniPlayerRow(
  row: { name: string | null; profile_id?: string | null },
  profileNameById?: Map<string, string | null>,
): boolean {
  const profileName = row.profile_id && profileNameById ? profileNameById.get(row.profile_id) ?? null : null;
  const display = scorecardDisplayName(row.name, profileName, row.profile_id ?? null);
  return (
    isAlumniDisplayName(display) ||
    isAlumniDisplayName(row.name) ||
    isAlumniDisplayName(profileName)
  );
}

/** Active roster for picks / forms (excludes alumni). */
export function filterActiveRosterPlayers<T extends { name: string | null; profile_id?: string | null }>(
  players: T[],
  profileNameById?: Map<string, string | null>,
): T[] {
  return players.filter((p) => !isAlumniPlayerRow(p, profileNameById));
}

export function filterActiveRosterNames(names: string[]): string[] {
  return names.filter((n) => !isAlumniDisplayName(n));
}

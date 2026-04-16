/** Shared name matching for legacy jersey/contribution rows (partial names vs full profile names). */

export function normalizeNameForMatch(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function compactNameForMatch(s: string | null | undefined): string {
  return normalizeNameForMatch(s).replace(/[^a-z0-9]/g, '');
}

/** Variants derived from a stored display name (profile, roster, etc.). */
export function nameVariantsFromStoredName(stored: string | null | undefined): Set<string> {
  const set = new Set<string>();
  const n = normalizeNameForMatch(stored);
  if (n) {
    set.add(n);
    set.add(compactNameForMatch(stored));
    for (const tok of n.split(' ')) {
      if (tok.length >= 2) set.add(tok);
    }
  }
  return set;
}

/** Variants for “this is me” checks (profile + linked roster). */
export function buildSelfNameVariants(
  profileName: string | null | undefined,
  rosterName: string | null | undefined,
): Set<string> {
  const set = new Set<string>();
  Array.from(nameVariantsFromStoredName(profileName)).forEach((x) => set.add(x));
  Array.from(nameVariantsFromStoredName(rosterName)).forEach((x) => set.add(x));
  return set;
}

export function nameMatchesSelfVariants(
  playerName: string | null | undefined,
  variants: Set<string>,
  fullNamesForPrefix: (string | null | undefined)[],
): boolean {
  const n = normalizeNameForMatch(playerName);
  const c = compactNameForMatch(playerName);
  if (n && variants.has(n)) return true;
  if (c && variants.has(c)) return true;
  if (n.length < 2) return false;
  for (const raw of fullNamesForPrefix) {
    const storedNorm = normalizeNameForMatch(raw);
    if (storedNorm && (storedNorm === n || storedNorm.startsWith(n + ' '))) return true;
  }
  return false;
}

/** Form / table `player_name` vs one profile or roster name (legacy rows). */
export function playerEnteredNameMatchesProfile(
  playerEntered: string | null | undefined,
  profileOrRosterName: string | null | undefined,
): boolean {
  const variants = nameVariantsFromStoredName(profileOrRosterName);
  const n = normalizeNameForMatch(playerEntered);
  const c = compactNameForMatch(playerEntered);
  if (n && variants.has(n)) return true;
  if (c && variants.has(c)) return true;
  const storedNorm = normalizeNameForMatch(profileOrRosterName);
  if (n.length >= 2 && storedNorm && (storedNorm === n || storedNorm.startsWith(n + ' '))) return true;
  return false;
}

type ProfileRow = { id: string; name: string | null };
type PlayerRow = { name: string | null; profile_id: string | null };

/**
 * If form name matches exactly one account (profile id), return that profile’s full name for display / owe grouping.
 * Ambiguous or no match → null (keep raw form name).
 */
/** When legacy `player_name` matches exactly one profile account, return that profile id (else null). */
export function uniqueInferredProfileIdForLegacyFormName(
  formName: string | null | undefined,
  profiles: ProfileRow[],
  players: PlayerRow[],
): string | null {
  const matchedProfileIds = new Set<string>();
  const profileById = new Map<string, ProfileRow>();
  for (const p of profiles) {
    profileById.set(p.id, p);
    if (playerEnteredNameMatchesProfile(formName, p.name)) matchedProfileIds.add(p.id);
  }
  for (const pl of players) {
    if (!pl.profile_id) continue;
    const prof = profileById.get(pl.profile_id);
    if (playerEnteredNameMatchesProfile(formName, pl.name)) matchedProfileIds.add(pl.profile_id);
    if (prof && playerEnteredNameMatchesProfile(formName, prof.name)) matchedProfileIds.add(pl.profile_id);
  }
  if (matchedProfileIds.size !== 1) return null;
  return Array.from(matchedProfileIds)[0];
}

export function uniqueInferredProfileFullNameForLegacyFormName(
  formName: string | null | undefined,
  profiles: ProfileRow[],
  players: PlayerRow[],
): string | null {
  const onlyId = uniqueInferredProfileIdForLegacyFormName(formName, profiles, players);
  if (!onlyId) return null;
  const name = profiles.find((p) => p.id === onlyId)?.name;
  const trimmed = (name ?? '').trim();
  return trimmed || null;
}

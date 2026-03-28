/** Heuristic: player.name was mistakenly set to login email. */
export function looksLikeEmail(s: string | null | undefined): boolean {
  const t = (s || '').trim();
  return /^\S+@\S+\.\S+$/.test(t);
}

/**
 * Show roster name on scorecards; if `players.name` is an email, prefer linked profile name.
 */
export function scorecardDisplayName(
  playerName: string | null | undefined,
  profileName: string | null | undefined,
  profileId: string | null | undefined,
): string {
  const raw = (playerName || '').trim();
  const prof = (profileName || '').trim();
  if (looksLikeEmail(raw) && profileId && prof) return prof;
  if (raw) return raw;
  if (prof) return prof;
  return 'Unknown';
}

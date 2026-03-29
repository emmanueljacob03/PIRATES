/** Heuristic: `players.name` was mistakenly set to login email (any substring like a@b.co). */
export function looksLikeEmail(s: string | null | undefined): boolean {
  const t = (s || '').trim();
  if (!t || !t.includes('@')) return false;
  return /\S+@\S+\.\S+/.test(t);
}

/**
 * Show a proper name on scorecards, leaderboard, dashboard — never the mistaken email string.
 * Prefer linked profile name when the roster field looks like an email.
 */
export function scorecardDisplayName(
  playerName: string | null | undefined,
  profileName: string | null | undefined,
  profileId: string | null | undefined,
): string {
  const raw = (playerName || '').trim();
  const prof = (profileName || '').trim();
  if (looksLikeEmail(raw)) {
    if (prof) return prof;
    return 'Player';
  }
  if (raw) return raw;
  if (prof) return prof;
  return 'Unknown';
}

/** Prefer squad photo, then linked profile avatar. */
export function playerPhotoUrl(
  playerPhoto: string | null | undefined,
  profileAvatarUrl: string | null | undefined,
): string | null {
  const a = (playerPhoto || '').trim();
  const b = (profileAvatarUrl || '').trim();
  return a || b || null;
}

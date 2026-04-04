import { playerEnteredNameMatchesProfile } from '@/lib/name-match';

/**
 * Legacy jerseys without submitted_by_id: infer submitter account when player_name
 * matches exactly one roster row (self-request). Friend / off-roster requests need submitted_by_id.
 */
export function legacyJerseySubmitterProfileId(
  playerName: string | null | undefined,
  players: { name: string | null; profile_id: string | null }[],
): string | null {
  const matches = players.filter(
    (pl) => pl.profile_id && playerEnteredNameMatchesProfile(playerName, pl.name),
  );
  if (matches.length !== 1) return null;
  return matches[0].profile_id!;
}

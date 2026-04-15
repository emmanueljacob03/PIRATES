/** Same rule as schedule list: practice rows use opponent text containing "practice" (e.g. Practice Session). */
export function isPracticeOpponent(opponent: string | null | undefined): boolean {
  return (opponent ?? '').toLowerCase().includes('practice');
}

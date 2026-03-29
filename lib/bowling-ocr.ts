import { extractOrderedNumbers } from '@/lib/batting-ocr';

export type ParsedBowling = {
  overs: number;
  maidens: number;
  runs_conceded: number;
  wickets: number;
};

/**
 * After player name, expect column order O, M, R, W (ER optional on some sheets).
 * Takes first line in snippet that has at least 4 numbers.
 */
export function bestBowlingFromSnippet(snippet: string): ParsedBowling | null {
  const lines = snippet.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const nums = extractOrderedNumbers(line);
    if (nums.length < 4) continue;
    const overs = Math.max(0, nums[0]);
    const maidens = Math.max(0, Math.round(nums[1]));
    const runs_conceded = Math.max(0, Math.round(nums[2]));
    const wickets = Math.max(0, Math.round(nums[3]));
    if (runs_conceded > 400 || wickets > 15) continue;
    return { overs, maidens, runs_conceded, wickets };
  }
  const all = extractOrderedNumbers(snippet);
  if (all.length < 4) return null;
  return {
    overs: Math.max(0, all[0]),
    maidens: Math.max(0, Math.round(all[1])),
    runs_conceded: Math.max(0, Math.round(all[2])),
    wickets: Math.max(0, Math.round(all[3])),
  };
}

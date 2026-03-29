import { extractOrderedNumbers } from '@/lib/batting-ocr';
import { normalizeDotOversInput } from '@/lib/cricket-overs';

export type ParsedBowling = {
  overs: number;
  maidens: number;
  runs_conceded: number;
  wickets: number;
};

/**
 * OCR may split dot overs "1.4" into 1, 4 before M, R, W → merge first two when plausible.
 */
export function repairBowlingNumberSequence(nums: number[]): number[] {
  if (nums.length >= 5) {
    const a = nums[0];
    const b = nums[1];
    if (
      Number.isInteger(a) &&
      Number.isInteger(b) &&
      a >= 0 &&
      a <= 30 &&
      b >= 0 &&
      b <= 5
    ) {
      const mergedO = normalizeDotOversInput(a + b / 10);
      const m = nums[2];
      const r = nums[3];
      const w = nums[4];
      if (
        m >= 0 &&
        m <= 12 &&
        r >= 0 &&
        r <= 400 &&
        w >= 0 &&
        w <= 15
      ) {
        return [mergedO, m, r, w, ...nums.slice(5)];
      }
    }
  }
  return nums;
}

function parseBowlingNums(nums: number[]): ParsedBowling | null {
  const n = repairBowlingNumberSequence(nums);
  if (n.length < 4) return null;
  const overs = normalizeDotOversInput(Math.max(0, n[0]));
  const maidens = Math.max(0, Math.round(n[1]));
  const runs_conceded = Math.max(0, Math.round(n[2]));
  const wickets = Math.max(0, Math.round(n[3]));
  if (runs_conceded > 400 || wickets > 15 || maidens > 12) return null;
  return { overs, maidens, runs_conceded, wickets };
}

/**
 * After player name, expect column order O, M, R, W (ER optional on some sheets).
 */
export function bestBowlingFromSnippet(snippet: string): ParsedBowling | null {
  const lines = snippet.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const nums = extractOrderedNumbers(line);
    const p = parseBowlingNums(nums);
    if (p) return p;
  }
  const all = extractOrderedNumbers(snippet);
  return parseBowlingNums(all);
}

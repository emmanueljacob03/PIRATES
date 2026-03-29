import { extractOrderedNumbers } from '@/lib/batting-ocr';
import { dotOversToTotalBalls, normalizeDotOversInput } from '@/lib/cricket-overs';

export type ParsedBowling = {
  overs: number;
  maidens: number;
  runs_conceded: number;
  wickets: number;
};

/**
 * OCR may split dot overs "1.4" into 1, 4 before M, R, W.
 * Do **not** merge when the second digit is 0 — that is almost always M=0 after whole overs (e.g. 4.0 → 4, 0, 20, 2),
 * not "0 balls" in a partial over.
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
      b >= 1 &&
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
  if (maidens > Math.ceil(overs + 0.001) + 1) return null;
  return { overs, maidens, runs_conceded, wickets };
}

function legalOversFromDot(oversDot: number): number {
  const balls = dotOversToTotalBalls(oversDot);
  return balls / 6;
}

function isPlausibleBowling(p: ParsedBowling): boolean {
  if (p.wickets > 15 || p.runs_conceded > 400 || p.maidens > 12) return false;
  if (p.overs <= 0 && p.wickets === 0 && p.runs_conceded === 0 && p.maidens === 0) return false;
  if (p.maidens > Math.ceil(p.overs + 0.001) + 1) return false;
  return true;
}

/** Prefer candidates whose implied economy matches an optional ER column (O M R W ER WD NB…). */
function bowlScore(p: ParsedBowling, numsAfterOmrw: number[]): number {
  if (!isPlausibleBowling(p)) return Number.NEGATIVE_INFINITY;
  let s = 0;
  const leg = legalOversFromDot(p.overs);
  if (leg > 0 && p.runs_conceded >= 0) {
    const er = p.runs_conceded / leg;
    if (er >= 1 && er <= 24) s += 20;
    const reported = numsAfterOmrw[0];
    if (reported != null && Number.isFinite(reported) && reported >= 1 && reported <= 30) {
      if (Math.abs(reported - er) <= 1.25) s += 45;
      else if (Math.abs(reported - er) <= 2.5) s += 18;
      else s -= 8;
    }
  }
  s += Math.min(p.wickets, 15) * 3 + Math.min(p.maidens, 12) * 2;
  return s;
}

/**
 * Like batting: stats are usually the last numbers on the row; sheets add ER, WD, NB after W.
 */
export function findBestBowlingFromNumberSeries(nums: number[]): ParsedBowling | null {
  if (!nums.length) return null;
  const repairedAll = repairBowlingNumberSequence([...nums]);
  const candidates: { p: ParsedBowling; score: number }[] = [];
  const seen = new Set<string>();

  for (const w of [8, 7, 6, 5, 4]) {
    if (repairedAll.length < w) continue;
    const slice = repairedAll.slice(-w);
    const p = parseBowlingNums(slice);
    if (!p || !isPlausibleBowling(p)) continue;
    const key = `${p.overs}-${p.maidens}-${p.runs_conceded}-${p.wickets}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const afterOmrw = slice.slice(4);
    candidates.push({ p, score: bowlScore(p, afterOmrw) });
  }

  if (!candidates.length) {
    const last = parseBowlingNums(repairedAll);
    return last && isPlausibleBowling(last) ? last : null;
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]!.p;
}

/**
 * Many sheets OCR as: line N = bowler name (+ figures inline), line N+1 = O M R W (or ER).
 * Same pattern as batting: claim name lines only; append following unclaimed lines until we have enough digits.
 */
export function buildBowlingOcrSnippet(
  allLines: string[],
  nameLineIndex: number,
  claimedLineIndices: Set<number>,
): string {
  if (nameLineIndex < 0 || nameLineIndex >= allLines.length) return '';
  const parts: string[] = [allLines[nameLineIndex]];
  const joinedCount = () => extractOrderedNumbers(parts.join(' ')).length;
  /** O M R W + ER + WD + NB → need enough digits to score with ER hint */
  if (joinedCount() >= 7) return parts.join('\n');
  const fewOnName = extractOrderedNumbers(allLines[nameLineIndex]).length < 2;
  for (let off = 1; off <= 5 && nameLineIndex + off < allLines.length; off++) {
    const ni = nameLineIndex + off;
    if (claimedLineIndices.has(ni)) break;
    parts.push(allLines[ni]);
    if (joinedCount() >= 7) break;
    if (fewOnName && joinedCount() >= 4) break;
    if (!fewOnName && joinedCount() >= 5) break;
  }
  return parts.join('\n');
}

/**
 * After player name, expect column order O, M, R, W (ER optional on some sheets).
 * Uses line-by-line parse first; then trailing number windows so jersey/extra digits on the name row do not swallow O/M/R/W.
 */
export function bestBowlingFromSnippet(snippet: string): ParsedBowling | null {
  const lines = snippet.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const nums = extractOrderedNumbers(line);
    const p = findBestBowlingFromNumberSeries(nums);
    if (p) return p;
  }
  const all = extractOrderedNumbers(snippet);
  return findBestBowlingFromNumberSeries(all);
}

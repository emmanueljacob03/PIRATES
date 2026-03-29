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
 * Do **not** merge when the second digit is 0 — that is almost always M=0 after whole overs (e.g. 4, 0, 20, 2),
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

/** Strip captain markers and column headers so digits line up with O M R W. */
export function sanitizeBowlingOcrLine(line: string): string {
  return (line || '')
    .replace(/\(C\)|\(c\)|\(VC\)|\(vc\)|†|‡/g, ' ')
    .replace(/\b(bowling|overs?|maidens?|runs?|wickets?|economy|econ|wide|wides|no\s*balls?)\b/gi, ' ')
    .replace(/\b(O|M|R|W|ER|WD|NB)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function legalOversFromDot(oversDot: number): number {
  const balls = dotOversToTotalBalls(oversDot);
  return balls / 6;
}

function isPlausibleBowling(p: ParsedBowling): boolean {
  if (p.wickets > 15 || p.runs_conceded > 400 || p.maidens > 12) return false;
  if (p.overs <= 0 && p.wickets === 0 && p.runs_conceded === 0 && p.maidens === 0) return false;
  if (p.maidens > Math.ceil(p.overs + 0.001) + 1) return false;
  if (p.wickets > 0 && p.overs <= 0) return false;
  return true;
}

/**
 * At nums[start..] build O/M/R/W candidates:
 * - Standard: O=a, M=b, R=c, W=d (four consecutive ints).
 * - Partial over: O=a+b/10 (b=1..5), M=c, R=d, W=e (needs five consecutive).
 */
function bowlingCandidatesAt(nums: number[], start: number): ParsedBowling[] {
  const out: ParsedBowling[] = [];
  if (start + 4 > nums.length) return out;
  const a = nums[start];
  const b = nums[start + 1];
  const c = nums[start + 2];
  const d = nums[start + 3];

  const oStd = normalizeDotOversInput(Math.max(0, Number(a)));
  const mStd = Math.max(0, Math.round(Number(b)));
  const rStd = Math.max(0, Math.round(Number(c)));
  const wStd = Math.max(0, Math.round(Number(d)));
  out.push({ overs: oStd, maidens: mStd, runs_conceded: rStd, wickets: wStd });

  if (start + 5 <= nums.length) {
    const e = nums[start + 4];
    const ai = Math.round(Number(a));
    const bi = Math.round(Number(b));
    if (Number.isFinite(a) && Number.isFinite(b) && bi >= 1 && bi <= 5 && ai >= 0 && ai <= 30) {
      const oPart = normalizeDotOversInput(ai + bi / 10);
      out.push({
        overs: oPart,
        maidens: Math.max(0, Math.round(Number(c))),
        runs_conceded: Math.max(0, Math.round(Number(d))),
        wickets: Math.max(0, Math.round(Number(e))),
      });
    }
  }
  return out;
}

/** Prefer economy-consistent rows when an ER value sits right after W. */
function bowlScore(p: ParsedBowling, numsAfterOmrw: number[]): number {
  if (!isPlausibleBowling(p)) return Number.NEGATIVE_INFINITY;
  let s = 0;
  const leg = legalOversFromDot(p.overs);
  if (leg > 0 && p.runs_conceded >= 0) {
    const er = p.runs_conceded / leg;
    if (er >= 0.5 && er <= 36) s += 28;
    const reported = numsAfterOmrw[0];
    if (reported != null && Number.isFinite(reported) && reported >= 0 && reported <= 40) {
      if (Math.abs(reported - er) <= 1.35) s += 55;
      else if (Math.abs(reported - er) <= 2.8) s += 22;
      else if (reported >= 1 && reported <= 30) s -= 6;
    }
  }
  s += Math.min(p.wickets, 15) * 4 + Math.min(p.maidens, 12) * 2;
  if (p.runs_conceded >= p.wickets && p.runs_conceded <= p.overs * 36 + 60) s += 6;
  return s;
}

/**
 * Slide over the **tail** of the number list (stats are right of the name; junk often leads).
 * This fixes the bug where we parsed the *first* four numbers of an 8-wide window instead of O/M/R/W.
 */
export function findBestBowlingFromNumberSeries(nums: number[]): ParsedBowling | null {
  if (nums.length < 4) return null;
  const TAIL = 26;
  const from = Math.max(0, nums.length - TAIL);
  const candidates: { p: ParsedBowling; score: number }[] = [];
  const seen = new Set<string>();

  for (let start = from; start <= nums.length - 4; start++) {
    const following = nums.slice(start + 4, start + 12);
    for (const p of bowlingCandidatesAt(nums, start)) {
      if (!isPlausibleBowling(p)) continue;
      const key = `${p.overs}-${p.maidens}-${p.runs_conceded}-${p.wickets}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ p, score: bowlScore(p, following) });
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]!.p;
}

/**
 * Many sheets OCR as: line N = bowler name + stats, or stats on the next line.
 */
export function buildBowlingOcrSnippet(
  allLines: string[],
  nameLineIndex: number,
  claimedLineIndices: Set<number>,
): string {
  if (nameLineIndex < 0 || nameLineIndex >= allLines.length) return '';
  const parts: string[] = [allLines[nameLineIndex]];
  const joinedCount = () => extractOrderedNumbers(parts.map((p) => sanitizeBowlingOcrLine(p)).join(' ')).length;
  if (joinedCount() >= 4) return parts.join('\n');
  const fewOnName = extractOrderedNumbers(sanitizeBowlingOcrLine(allLines[nameLineIndex])).length < 2;
  for (let off = 1; off <= 5 && nameLineIndex + off < allLines.length; off++) {
    const ni = nameLineIndex + off;
    if (claimedLineIndices.has(ni)) break;
    parts.push(allLines[ni]);
    if (joinedCount() >= 4) break;
    if (fewOnName && joinedCount() >= 2) break;
  }
  return parts.join('\n');
}

/**
 * One snippet = one player’s block (name line + optional continuation). Join lines so O M R W stay in order.
 */
export function bestBowlingFromSnippet(snippet: string): ParsedBowling | null {
  const lines = snippet.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const combined = extractOrderedNumbers(lines.map(sanitizeBowlingOcrLine).join(' '));
  return findBestBowlingFromNumberSeries(combined);
}

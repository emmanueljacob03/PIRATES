/**
 * Heuristics for batting scorecard OCR: column order R, B, 4s, 6s, SR (strike rate).
 */

/** Unicode fullwidth digits → ASCII so \d+ can see them. */
function normalizeOcrDigitChars(s: string): string {
  return (s || '').replace(/[\uFF10-\uFF19]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30),
  );
}

export function extractOrderedNumbers(snippet: string): number[] {
  const s = normalizeOcrDigitChars(snippet).replace(/\r\n?/g, '\n');
  const m = s.match(/\d+\.\d+|\d+/g);
  if (!m) return [];
  return m.map((x) => parseFloat(x)).filter((n) => Number.isFinite(n));
}

export type ParsedBatting = {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
};

/**
 * OCR often splits "46" into 4 and 6. Merge when the next value looks like balls faced.
 */
export function repairBattingNumberSequence(nums: number[]): number[] {
  if (nums.length < 3) return nums;
  const a0 = nums[0];
  const a1 = nums[1];
  if (
    Number.isInteger(a0) &&
    Number.isInteger(a1) &&
    a0 >= 0 &&
    a0 <= 9 &&
    a1 >= 0 &&
    a1 <= 9 &&
    !(a0 === 0 && a1 === 0)
  ) {
    const merged = a0 * 10 + a1;
    const balls = nums[2];
    if (
      merged >= 10 &&
      merged <= 350 &&
      balls >= 1 &&
      balls <= 180 &&
      Number.isFinite(balls)
    ) {
      return [merged, balls, ...nums.slice(3)];
    }
  }
  return nums;
}

/**
 * From a contiguous list of numbers after a player name, infer R / B / 4s / 6s.
 * Prefers 5-value rows (with SR) when the last value matches runs/balls*100.
 */
export function parseBattingNumbers(nums: number[]): ParsedBatting | null {
  nums = repairBattingNumberSequence(nums);
  const n = nums.length;
  if (n >= 5) {
    const runs = Math.max(0, Math.round(nums[0]));
    const balls = Math.max(0, Math.round(nums[1]));
    const fours = Math.max(0, Math.round(nums[2]));
    const sixes = Math.max(0, Math.round(nums[3]));
    const srReported = nums[4];
    if (balls > 0 && runs <= 400) {
      const expectedSr = (runs / balls) * 100;
      if (Math.abs(srReported - expectedSr) <= Math.max(12, expectedSr * 0.08)) {
        return { runs, balls, fours, sixes };
      }
    }
    return { runs, balls, fours, sixes: Math.max(0, Math.round(nums[3])) };
  }
  if (n >= 4) {
    return {
      runs: Math.max(0, Math.round(nums[0])),
      balls: Math.max(0, Math.round(nums[1])),
      fours: Math.max(0, Math.round(nums[2])),
      sixes: Math.max(0, Math.round(nums[3])),
    };
  }
  if (n === 3) {
    const a = Math.max(0, Math.round(nums[0]));
    const b = Math.max(0, Math.round(nums[1]));
    const t = nums[2];
    const tInt = Math.max(0, Math.round(t));
    const variants: ParsedBatting[] = [];
    const vseen = new Set<string>();
    const push = (p: ParsedBatting) => {
      const key = `${p.runs}-${p.balls}-${p.fours}-${p.sixes}`;
      if (vseen.has(key)) return;
      vseen.add(key);
      variants.push(p);
    };
    const trySr = (runs: number, balls: number) => {
      if (balls >= 1 && runs <= 400 && balls <= 200 && t >= 50 && t <= 300) {
        const expectedSr = (runs / balls) * 100;
        if (Math.abs(t - expectedSr) <= Math.max(18, expectedSr * 0.12)) {
          push({ runs, balls, fours: 0, sixes: 0 });
        }
      }
    };
    trySr(a, b);
    trySr(b, a);
    const tryFours = (runs: number, balls: number) => {
      if (runs <= 400 && balls <= 200 && tInt <= 30) {
        push({ runs, balls, fours: tInt, sixes: 0 });
      }
    };
    tryFours(a, b);
    tryFours(b, a);
    let best3: ParsedBatting | null = null;
    let bestS3 = Number.NEGATIVE_INFINITY;
    for (const v of variants) {
      const s = batScore(v);
      if (s > bestS3) {
        bestS3 = s;
        best3 = v;
      }
    }
    if (best3 && isPlausibleBatting(best3)) return best3;
  }
  if (n >= 2) {
    return {
      runs: Math.max(0, Math.round(nums[0])),
      balls: Math.max(0, Math.round(nums[1])),
      fours: 0,
      sixes: 0,
    };
  }
  return null;
}

/** Strip captain / keeper markers for looser OCR matching. */
export function stripRoleMarkers(name: string): string {
  return (name || '')
    .replace(/\s*\(?\s*[CW]K\s*\)?\s*/gi, ' ')
    .replace(/\s*\(?\s*C\s*\)?\s*/gi, ' ')
    .replace(/†/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Clean OCR batting line: not-out stars, odd spaces. */
function cleanBattingLineForOcr(line: string): string {
  return (line || '')
    .replace(/[*†‡]/g, ' ')
    .replace(/[|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPlausibleBatting(p: ParsedBatting): boolean {
  if (p.runs + p.balls <= 0) return false;
  if (p.runs > 450 || p.balls > 200) return false;
  if (p.fours > 50 || p.sixes > 40) return false;
  if (p.runs > 0 && p.balls === 0) return false;
  return true;
}

/** Higher = more likely correct R–B–4s–6s for typical scorecards. */
function batScore(p: ParsedBatting): number {
  if (!isPlausibleBatting(p)) return Number.NEGATIVE_INFINITY;
  let s = 0;
  const boundaryRuns = p.fours * 4 + p.sixes * 6;
  const nonBoundary = p.runs - boundaryRuns;
  if (p.balls > 0) {
    const sr = (p.runs / p.balls) * 100;
    if (sr >= 35 && sr <= 220) s += 40;
    else if (sr >= 15 && sr <= 320) s += 20;
    else s -= 25;
  }
  if (nonBoundary >= -2 && nonBoundary <= p.balls + p.fours * 2 + p.sixes * 3) s += 30;
  else if (nonBoundary >= -15 && nonBoundary <= p.balls * 2 + 20) s += 10;
  else s -= 35;
  const bBound = p.fours + p.sixes;
  if (bBound <= p.balls + 2) s += 24;
  else if (bBound <= p.balls + 10) s += 8;
  else s -= (bBound - p.balls) * 8;
  if (p.sixes * 6 + p.fours * 4 > p.runs + 8) s -= 50;
  if (p.runs > p.balls * 4 && p.balls > 8) s -= 15;
  s += Math.min(p.runs, 260) * 0.03;
  return s;
}

/**
 * Batting stats are almost always the last numbers on the line (R B 4s 6s [SR]).
 * We only consider suffix windows and pick by plausibility score — not raw sum of digits.
 */
export function findBestBattingFromNumberSeries(nums: number[]): ParsedBatting | null {
  if (!nums.length) return null;
  const candidates: ParsedBatting[] = [];
  const seen = new Set<string>();
  const add = (p: ParsedBatting | null) => {
    if (!p || !isPlausibleBatting(p)) return;
    const key = `${p.runs}-${p.balls}-${p.fours}-${p.sixes}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(p);
  };

  const trySlice = (slice: number[]) => {
    if (slice.length < 2) return;
    const r = repairBattingNumberSequence([...slice]);
    add(parseBattingNumbers(r));
    if (r.length >= 4) {
      add({
        runs: Math.max(0, Math.round(r[1])),
        balls: Math.max(0, Math.round(r[0])),
        fours: Math.max(0, Math.round(r[2])),
        sixes: Math.max(0, Math.round(r[3])),
      });
    }
  };

  const repairedAll = repairBattingNumberSequence([...nums]);
  for (const w of [6, 5, 4, 3, 2]) {
    if (repairedAll.length >= w) trySlice(repairedAll.slice(-w));
  }

  if (!candidates.length) {
    const last = parseBattingNumbers(repairedAll);
    if (last && isPlausibleBatting(last)) return last;
    return null;
  }

  let best: ParsedBatting | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const c of candidates) {
    const sc = batScore(c);
    if (sc > bestScore) {
      bestScore = sc;
      best = c;
    }
  }
  return best;
}

/**
 * Many scorecards OCR as: line N = player name (+ dismissal text, few digits), line N+1 = R B 4s 6s SR.
 * Only lines where a name matched are "claimed"; stats-only lines stay unclaimed — we may append them.
 */
export function buildBattingOcrSnippet(
  allLines: string[],
  nameLineIndex: number,
  claimedLineIndices: Set<number>,
): string {
  if (nameLineIndex < 0 || nameLineIndex >= allLines.length) return '';
  const parts: string[] = [allLines[nameLineIndex]];
  let joinedNums = extractOrderedNumbers(
    parts.map((p) => cleanBattingLineForOcr(p)).join(' '),
  ).length;
  if (joinedNums >= 4) return parts.join('\n');

  const fewDigitsOnNameRow =
    extractOrderedNumbers(cleanBattingLineForOcr(allLines[nameLineIndex])).length < 2;

  for (let off = 1; off <= 3 && nameLineIndex + off < allLines.length; off++) {
    const ni = nameLineIndex + off;
    if (claimedLineIndices.has(ni)) break;
    parts.push(allLines[ni]);
    joinedNums = extractOrderedNumbers(
      parts.map((p) => cleanBattingLineForOcr(p)).join(' '),
    ).length;
    if (joinedNums >= 4) break;
    if (fewDigitsOnNameRow && joinedNums >= 2) break;
  }
  return parts.join('\n');
}

/**
 * Prefer a line that looks like a batting row (R B 4s 6s [SR]) over noisy OCR from dismissals.
 */
export function bestBattingFromSnippet(snippet: string): ParsedBatting | null {
  const lines = snippet.split(/\n/).map((l) => cleanBattingLineForOcr(l)).filter(Boolean);
  for (const line of lines) {
    const nums = extractOrderedNumbers(line);
    const p = findBestBattingFromNumberSeries(nums);
    if (p && p.runs <= 450 && p.balls <= 200) return p;
  }
  const all = extractOrderedNumbers(cleanBattingLineForOcr(snippet));
  const fallback = findBestBattingFromNumberSeries(all);
  if (fallback && fallback.runs <= 450 && fallback.balls <= 200) return fallback;
  return null;
}

/**
 * Heuristics for batting scorecard OCR: column order R, B, 4s, 6s, SR (strike rate).
 */

export function extractOrderedNumbers(snippet: string): number[] {
  const m = snippet.match(/\d+\.\d+|\d+/g);
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

/**
 * Try every plausible window — jersey / dismissal text often adds extra leading digits;
 * stats are often the last 4–5 numbers on the line.
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
  for (const w of [5, 4, 2]) {
    for (let i = 0; i + w <= repairedAll.length; i++) {
      trySlice(repairedAll.slice(i, i + w));
    }
  }
  for (const w of [6, 5, 4]) {
    if (repairedAll.length >= w) trySlice(repairedAll.slice(-w));
  }

  if (!candidates.length) {
    const last = parseBattingNumbers(repairedAll);
    if (
      last &&
      last.runs + last.balls > 0 &&
      last.runs <= 450 &&
      last.balls <= 200 &&
      last.fours <= 50 &&
      last.sixes <= 40 &&
      !(last.runs > 0 && last.balls === 0)
    ) {
      return last;
    }
    return null;
  }

  candidates.sort((a, b) => {
    const ta = a.runs + a.balls;
    const tb = b.runs + b.balls;
    if (tb !== ta) return tb - ta;
    return b.runs - a.runs;
  });
  return candidates[0] ?? null;
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

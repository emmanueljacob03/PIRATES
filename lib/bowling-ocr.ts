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
 * Do **not** merge when the second digit is 0 — that is M=0 after whole overs (4, 0, 20, 2).
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

/**
 * OCR merges "4.0"/"3.0" into 40/30, or "1.0" into 170. Do **not** treat (20,0,20) as overs after a
 * row has already started (O, M=0) — that pattern is **runs**, not 2.0 overs.
 */
export function repairOcrTenTimesOvers(nums: number[]): number[] {
  const out = [...nums];
  for (let i = 0; i < out.length - 2; i++) {
    const a = Math.round(Number(out[i]));
    const b = Math.round(Number(out[i + 1]));
    const c = Number(out[i + 2]);
    if (b !== 0) continue;
    if (!Number.isFinite(c) || c < 0 || c > 400) continue;
    /**
     * After normalising leading overs (e.g. 170→1), the tuple is O,M,R,W,…
     * A triple (20,0,20) here is **R then W then ER**, not "20→2.0 overs".
     * Skip ×10 repair when the two cells before i already look like O + M=0.
     */
    if (i >= 2) {
      const prevO = Number(out[i - 2]);
      const prevM = Math.round(Number(out[i - 1]));
      if (Number.isFinite(prevO) && prevO >= 0 && prevO <= 13 && prevM === 0) {
        continue;
      }
    }
    if (a >= 10 && a <= 120 && a % 10 === 0) {
      out[i] = a / 10;
      continue;
    }
    if (a >= 121 && a <= 130 && a % 10 === 0) {
      out[i] = a / 10;
      continue;
    }
    if (a > 120 && a <= 220 && a % 10 === 0 && a / 10 > 13) {
      out[i] = Math.floor(a / 100);
      continue;
    }
  }
  return out;
}

/**
 * Economy "5.00" / "12.50" often OCR as 500 / 1250 (decimal dropped).
 */
export function squashEconomyOcrGluedDigits(nums: number[]): number[] {
  return nums.map((n) => {
    if (!Number.isFinite(n)) return n;
    const x = Math.round(Number(n));
    if (x < 300 || x > 20000 || x % 50 !== 0) return n;
    const er = x / 100;
    if (er >= 0.5 && er <= 45) return er;
    return n;
  });
}

/**
 * Many scorecard apps print **M=0** as a blank or OCR drops it → "4 20 2 5" instead of "4 0 20 2 5".
 * Insert a maiden 0 when O is spell-sized and the next token looks like runs (not a maiden count).
 */
export function insertImplicitMaidenAfterOvers(nums: number[]): number[] {
  const out = [...nums];
  let i = 0;
  while (i < out.length - 2) {
    const a = out[i];
    const b = out[i + 1];
    const c = out[i + 2];
    const ai = Math.round(Number(a));
    const bi = Math.round(Number(b));
    const ci = Math.round(Number(c));
    if (
      ai >= 1 &&
      ai <= 12 &&
      bi > 12 &&
      bi <= 220 &&
      ci >= 0 &&
      ci <= 15 &&
      Number.isFinite(a) &&
      Number.isFinite(b) &&
      Number.isFinite(c)
    ) {
      out.splice(i + 1, 0, 0);
      i += 2;
      continue;
    }
    i++;
  }
  return out;
}

/** Strip captain markers; avoid stripping single letters O/M/R/W (hurts names, rarely needed on stat cells). */
export function sanitizeBowlingOcrLine(line: string): string {
  return (line || '')
    .replace(/\(C\)|\(c\)|\(VC\)|\(vc\)|†|‡/g, ' ')
    .replace(/\b(bowling|economy|econ|wides?|no\s*balls?)\b/gi, ' ')
    .replace(/\b(maidens?|wickets?|overs?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function legalOversFromDot(oversDot: number): number {
  const balls = dotOversToTotalBalls(oversDot);
  return balls / 6;
}

/** Club scorecard row: single spell rarely exceeds ~12 legal overs; stricter O weeds out R,W shifted into O,M. */
function isPlausibleBowling(p: ParsedBowling): boolean {
  if (p.wickets > 15 || p.runs_conceded > 400 || p.maidens > 12) return false;
  if (p.overs <= 0 && p.wickets === 0 && p.runs_conceded === 0 && p.maidens === 0) return false;
  if (p.wickets > 0 && p.overs <= 0) return false;
  if (p.maidens > Math.ceil(p.overs + 0.001) + 1) return false;
  const leg = legalOversFromDot(p.overs);
  if (leg <= 0) return false;
  /** Reject R/W read as O/M (e.g. O=20, M=2); allow up to ~13 legal overs for long spells. */
  if (leg > 13) return false;
  if (p.wickets > 10) return false;
  if (leg > 0 && p.runs_conceded / leg > 40) return false;
  return true;
}

/**
 * OCR drops a trailing zero on runs (2 vs 20) while ER column is often clean.
 * If runs 1–9 but ER×legal_overs ≈ runs×10, trust implied runs from ER.
 */
function alignRunsToReportedEconomy(p: ParsedBowling, following: number[]): ParsedBowling {
  const leg = legalOversFromDot(p.overs);
  if (leg <= 0) return p;
  const erRep = following[0];
  if (erRep == null || !Number.isFinite(erRep) || erRep < 2 || erRep > 45) return p;
  const implied = erRep * leg;
  const rc = p.runs_conceded;
  if (rc < 1 || rc > 9) return p;
  if (implied < 10) return p;
  if (Math.abs(implied - rc * 10) <= Math.max(2.5, implied * 0.08)) {
    return { ...p, runs_conceded: Math.round(implied) };
  }
  return p;
}

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

function erFitScore(p: ParsedBowling, following: number[]): number {
  const leg = legalOversFromDot(p.overs);
  if (leg <= 0) return -1e6;
  const er = p.runs_conceded / leg;
  let best = -1e3;
  for (const rpt of following.slice(0, 4)) {
    if (rpt == null || !Number.isFinite(rpt)) continue;
    if (rpt < 0 || rpt > 45) continue;
    const err = Math.abs(rpt - er);
    best = Math.max(best, 200 - err * 15);
  }
  return best;
}

function bowlScore(p: ParsedBowling, numsAfterOmrw: number[]): number {
  if (!isPlausibleBowling(p)) return Number.NEGATIVE_INFINITY;
  let s = 0;
  const leg = legalOversFromDot(p.overs);
  if (leg > 0 && p.runs_conceded >= 0) {
    const er = p.runs_conceded / leg;
    if (er >= 0.5 && er <= 36) s += 28;
    const reported = numsAfterOmrw[0];
    if (reported != null && Number.isFinite(reported) && reported >= 0 && reported <= 45) {
      if (Math.abs(reported - er) <= 1.25) s += 70;
      else if (Math.abs(reported - er) <= 2.5) s += 28;
      else if (reported >= 1 && reported <= 30) s -= 8;
    }
  }
  s += Math.min(p.wickets, 15) * 4 + Math.min(p.maidens, 12) * 2;
  if (p.maidens <= leg + 0.01 && p.wickets <= 8 && p.runs_conceded <= leg * 36 + 80) s += 12;
  return s;
}

export function findBestBowlingFromNumberSeries(numsRaw: number[]): ParsedBowling | null {
  const nums = repairBowlingNumberSequence(
    squashEconomyOcrGluedDigits(
      repairOcrTenTimesOvers(insertImplicitMaidenAfterOvers([...numsRaw])),
    ),
  );
  if (nums.length < 4) return null;
  const TAIL = 28;
  const from = Math.max(0, nums.length - TAIL);
  const candidates: { p: ParsedBowling; erFit: number; score: number }[] = [];
  const seen = new Set<string>();

  for (let start = from; start <= nums.length - 4; start++) {
    const following = nums.slice(start + 4, start + 14);
    for (const p0 of bowlingCandidatesAt(nums, start)) {
      const p = alignRunsToReportedEconomy(p0, following);
      if (!isPlausibleBowling(p)) continue;
      const key = `${p.overs}-${p.maidens}-${p.runs_conceded}-${p.wickets}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        p,
        erFit: erFitScore(p, following),
        score: bowlScore(p, following),
      });
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    if (b.erFit !== a.erFit) return b.erFit - a.erFit;
    return b.score - a.score;
  });
  return candidates[0]!.p;
}

export function buildBowlingOcrSnippet(
  allLines: string[],
  nameLineIndex: number,
  claimedLineIndices: Set<number>,
): string {
  if (nameLineIndex < 0 || nameLineIndex >= allLines.length) return '';
  const parts: string[] = [allLines[nameLineIndex]];
  let joinedNums = extractOrderedNumbers(
    parts.map((p) => sanitizeBowlingOcrLine(p)).join(' '),
  ).length;
  if (joinedNums >= 4) return parts.join('\n');

  const fewDigitsOnNameRow =
    extractOrderedNumbers(sanitizeBowlingOcrLine(allLines[nameLineIndex])).length < 2;

  for (let off = 1; off <= 3 && nameLineIndex + off < allLines.length; off++) {
    const ni = nameLineIndex + off;
    if (claimedLineIndices.has(ni)) break;
    parts.push(allLines[ni]);
    joinedNums = extractOrderedNumbers(
      parts.map((p) => sanitizeBowlingOcrLine(p)).join(' '),
    ).length;
    if (joinedNums >= 4) break;
    if (fewDigitsOnNameRow && joinedNums >= 2) break;
  }
  return parts.join('\n');
}

export function bestBowlingFromSnippet(snippet: string): ParsedBowling | null {
  const lines = snippet.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  for (const line of lines) {
    const nums = extractOrderedNumbers(sanitizeBowlingOcrLine(line));
    const p = findBestBowlingFromNumberSeries(nums);
    if (p && isPlausibleBowling(p)) return p;
  }
  const combined = extractOrderedNumbers(lines.map(sanitizeBowlingOcrLine).join(' '));
  return findBestBowlingFromNumberSeries(combined);
}

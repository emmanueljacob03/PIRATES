import { extractOrderedNumbers, stripRoleMarkers } from '@/lib/batting-ocr';
import { sanitizeBowlingOcrLine } from '@/lib/bowling-ocr';

export type BowlingLineHit = {
  line: string;
  lineIndex: number;
  /** Line indices to mark claimed (e.g. bare surname row below the stats line). */
  claimExtra: number[];
};

/** Text before the first digit on a bowling row — separates name cells from O·M·R·W stats. */
export function extractBowlingNamePrefixBeforeStats(line: string): string {
  const raw = (line || '').trim();
  if (!raw) return '';
  const idx = raw.search(/\d/);
  if (idx < 0) return raw.replace(/[\s.|\-–—:_]+$/g, '').trim();
  if (idx === 0) return '';
  return raw
    .slice(0, idx)
    .replace(/[\s.|\-–—:_]+$/g, '')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  const dp = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[n]!;
}

function similarityRatio(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const d = levenshtein(a, b);
  return 1 - d / Math.max(a.length, b.length);
}

/** True if roster token is present in OCR text or close to some OCR word (1↔l, short typos). */
function rosterTokenAppearsInOcrText(token: string, ocr: string, oWords: string[]): boolean {
  if (token.length < 2) return false;
  if (ocr.includes(token)) return true;
  const thresh = token.length <= 4 ? 0.72 : 0.82;
  for (const w of oWords) {
    if (w.length < 2) continue;
    if (similarityRatio(token, w) >= thresh) return true;
    if (token.length >= 4 && w.includes(token)) return true;
    if (w.length >= 4 && token.includes(w) && w.length + 1 >= token.length) return true;
  }
  return false;
}

function lettersOnly(s: string): string {
  return normalizeScorecardName(s).replace(/\s+/g, '');
}

function isJunkBowlingNamePrefix(norm: string): boolean {
  if (!norm || norm.replace(/[^a-z]/gi, '').length < 2) return true;
  const n = norm.replace(/\s+/g, ' ').trim();
  if (/^(o\s*m\s*r|o\s*m\s*r\s*w|bowling|econ|economy|wides?)\b/i.test(n)) return true;
  if (/^(wkts?|maid)\b/i.test(n)) return true;
  return false;
}

/**
 * How well roster `playerName` matches the OCR fragment before stats (typos, missing middle names).
 * Returns 0–100; use with a threshold for auto-fill so missing players stay empty.
 */
export function scoreRosterNameAgainstBowlingOcrPrefix(
  playerName: string,
  ocrNamePrefix: string,
): number {
  const ocr = normalizeScorecardName(ocrNamePrefix);
  const roster = normalizeScorecardName(stripRoleMarkers(playerName));
  if (isJunkBowlingNamePrefix(ocr) || ocr.length < 2 || roster.length < 2) return 0;

  let best = 0;
  const bump = (x: number) => {
    if (x > best) best = x;
  };

  if (roster.includes(ocr) && ocr.length >= 4) bump(88 + Math.min(ocr.length, 10) * 0.4);
  if (ocr.includes(roster) && roster.length >= 5) bump(91);

  const rParts = roster.split(' ').filter((t) => t.length > 0);
  const oParts = ocr.split(' ').filter((t) => t.length > 0);

  const cR = lettersOnly(roster);
  const cO = lettersOnly(ocr);
  if (cR.length >= 5 && cO.length >= 4) {
    if (cO.includes(cR) || cR.includes(cO)) bump(93);
    const csim = similarityRatio(cR, cO);
    if (csim >= 0.78) bump(100 * csim - 1);
    else if (csim >= 0.72 && cR.length >= 8) bump(100 * csim - 6);
  }

  const firstT = rParts[0];
  const lastT = rParts[rParts.length - 1];
  if (firstT?.length >= 3 && rosterTokenAppearsInOcrText(firstT, ocr, oParts)) {
    bump(74);
    if (lastT && lastT !== firstT && lastT.length >= 3 && rosterTokenAppearsInOcrText(lastT, ocr, oParts)) {
      bump(95);
    }
  }
  if (rParts[0]?.length >= 3 && ocr.includes(rParts[0])) {
    bump(72);
    const last = rParts[rParts.length - 1];
    if (last && last.length >= 4 && ocr.includes(last)) bump(94);
  }

  for (const alias of aliasesForScorecardName(playerName)) {
    if (alias.length < 3) continue;
    if (ocr === alias) bump(100);
    if (ocr.includes(alias)) bump(93 + Math.min(alias.length, 12) * 0.25);
    if (alias.includes(ocr) && ocr.length >= 5) bump(87);
    const sim = similarityRatio(alias, ocr);
    if (sim >= 0.88) bump(100 * sim);
    else if (sim >= 0.78 && alias.length >= 4) bump(100 * sim - 2);
    else if (sim >= 0.72 && alias.length >= 6) bump(100 * sim - 6);
    if (alias.length >= 4) {
      const aCompact = lettersOnly(alias);
      if (aCompact.length >= 5 && (cO.includes(aCompact) || similarityRatio(aCompact, cO) >= 0.76)) {
        bump(89);
      }
    }
  }

  if (rParts.length >= 2) {
    const longToks = rParts.filter((t) => t.length >= 3);
    const hitExact = longToks.filter((t) => ocr.includes(t)).length;
    const hitFuzzy = longToks.filter((t) => rosterTokenAppearsInOcrText(t, ocr, oParts)).length;
    const hit = Math.max(hitExact, hitFuzzy);
    const need =
      longToks.length <= 1
        ? 1
        : Math.max(2, Math.ceil(longToks.length * 0.5));
    const relaxedNeed = Math.max(1, Math.ceil(longToks.length * 0.45));
    if (longToks.length > 0 && hit >= need) bump(76 + hit * 5);
    else if (longToks.length >= 2 && hitFuzzy >= relaxedNeed && hitFuzzy >= 2) bump(73 + hitFuzzy * 4);
  }

  if (oParts.length >= 2 && rParts.length >= 2) {
    const olap = oParts.filter(
      (t) => t.length >= 3 && rosterTokenAppearsInOcrText(t, roster, rParts),
    ).length;
    if (olap >= 2) bump(80 + olap * 6);
  }

  return Math.min(100, Math.round(best * 10) / 10);
}

/** Letters left after stripping digits — rescues matches when OCR puts a digit inside the name (bad prefix cut). */
function bowlingOcrNameBlobFromLine(line: string): string {
  const s = sanitizeBowlingOcrLine(line).replace(/\d+\.?\d*/g, ' ');
  return normalizeScorecardName(s).replace(/\s+/g, ' ').trim();
}

function bowlingLineLooksLikeStatRow(line: string, digitCount: number): boolean {
  if (digitCount >= 4) return true;
  if (digitCount < 3) return false;
  const pre = extractBowlingNamePrefixBeforeStats(line);
  const preLetters = pre.replace(/[^A-Za-z]/g, '').length;
  const blobLetters = bowlingOcrNameBlobFromLine(line).replace(/[^a-z]/gi, '').length;
  return preLetters >= 4 || blobLetters >= 6;
}

/**
 * Match against both “text before first digit” and the whole line with numbers removed (OCR often splits names wrong).
 */
export function scoreRosterAgainstFullBowlingLine(playerName: string, line: string): number {
  const prefix = extractBowlingNamePrefixBeforeStats(line);
  const fromPrefix = scoreRosterNameAgainstBowlingOcrPrefix(playerName, prefix);
  const blob = bowlingOcrNameBlobFromLine(line);
  if (!blob || blob.length < 3 || isJunkBowlingNamePrefix(blob)) return fromPrefix;
  const fromBlob = scoreRosterNameAgainstBowlingOcrPrefix(playerName, blob);
  return Math.min(100, Math.round(Math.max(fromPrefix, fromBlob) * 10) / 10);
}

/** High-confidence row ↔ player edges; second pass uses RELAXED for anyone still unmatched. */
const BOWLING_GREEDY_MIN_SCORE = 72;
const BOWLING_GREEDY_RELAXED_MIN_SCORE = 50;
/** Last chance: line must “prefer” this player clearly over other unmatched candidates. */
const BOWLING_GREEDY_WEAK_MIN_SCORE = 44;
const BOWLING_WEAK_MARGIN = 7;
const BOWLING_FALLBACK_MIN_SCORE = 48;

type GreedyBowlingPair = {
  playerId: string;
  lineIndex: number;
  score: number;
};

function applyGreedyPairs(
  pairs: GreedyBowlingPair[],
  lines: string[],
  usedPlayers: Set<string>,
  usedLines: Set<number>,
  out: Map<string, BowlingLineHit>,
): void {
  const sorted = [...pairs].sort((a, b) => b.score - a.score);
  for (const p of sorted) {
    if (usedPlayers.has(p.playerId) || usedLines.has(p.lineIndex)) continue;
    usedPlayers.add(p.playerId);
    usedLines.add(p.lineIndex);
    out.set(p.playerId, {
      line: lines[p.lineIndex]!,
      lineIndex: p.lineIndex,
      claimExtra: [],
    });
  }
}

/**
 * Parse each OCR row into (name prefix, stats) and **globally** assign lines to squad players
 * (highest confidence first, one line per player) so row order gaps do not mis-attach stats.
 * Uses two score thresholds so everyone who clearly appears (e.g. Anil Kumar Chandu) still gets a row
 * after stronger matches (e.g. Emmanuel) claim their lines first.
 */
function applyWeakUniqueLinePairs(
  lines: string[],
  players: { id: string; name: string }[],
  statIndices: number[],
  usedPlayers: Set<string>,
  usedLines: Set<number>,
  out: Map<string, BowlingLineHit>,
): void {
  for (const lineIndex of statIndices) {
    if (usedLines.has(lineIndex)) continue;
    const line = lines[lineIndex]!;
    type Sc = { id: string; score: number };
    const scored: Sc[] = [];
    for (const pl of players) {
      if (usedPlayers.has(pl.id)) continue;
      const score = scoreRosterAgainstFullBowlingLine(pl.name, line);
      if (score >= BOWLING_GREEDY_WEAK_MIN_SCORE) scored.push({ id: pl.id, score });
    }
    if (scored.length === 0) continue;
    scored.sort((x, y) => y.score - x.score);
    const top = scored[0]!;
    const second = scored[1]?.score ?? -1;
    if (top.score - second < BOWLING_WEAK_MARGIN) continue;
    usedPlayers.add(top.id);
    usedLines.add(lineIndex);
    out.set(top.id, { line, lineIndex, claimExtra: [] });
  }
}

export function matchBowlingStatLinesToPlayersGreedy(
  lines: string[],
  players: { id: string; name: string }[],
): Map<string, BowlingLineHit> {
  const out = new Map<string, BowlingLineHit>();
  const digitsOnLine = (s: string) => extractOrderedNumbers(sanitizeBowlingOcrLine(s)).length;

  const statIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const d = digitsOnLine(lines[i]!);
    if (!bowlingLineLooksLikeStatRow(lines[i]!, d)) continue;
    const prefix = extractBowlingNamePrefixBeforeStats(lines[i]!);
    const prefixNorm = normalizeScorecardName(prefix);
    if (isJunkBowlingNamePrefix(prefixNorm)) {
      const blob = bowlingOcrNameBlobFromLine(lines[i]!);
      if (blob.replace(/[^a-z]/gi, '').length < 3) continue;
    } else if (
      prefix.replace(/[^A-Za-z]/g, '').length < 2 &&
      bowlingOcrNameBlobFromLine(lines[i]!).replace(/[^a-z]/gi, '').length < 4
    ) {
      continue;
    }
    statIndices.push(i);
  }

  const usedLines = new Set<number>();
  const usedPlayers = new Set<string>();

  const pairsStrict: GreedyBowlingPair[] = [];
  const pairsRelaxed: GreedyBowlingPair[] = [];
  for (const lineIndex of statIndices) {
    const line = lines[lineIndex]!;
    for (const pl of players) {
      const score = scoreRosterAgainstFullBowlingLine(pl.name, line);
      if (score >= BOWLING_GREEDY_MIN_SCORE) {
        pairsStrict.push({ playerId: pl.id, lineIndex, score });
      } else if (score >= BOWLING_GREEDY_RELAXED_MIN_SCORE) {
        pairsRelaxed.push({ playerId: pl.id, lineIndex, score });
      }
    }
  }

  applyGreedyPairs(pairsStrict, lines, usedPlayers, usedLines, out);
  applyGreedyPairs(pairsRelaxed, lines, usedPlayers, usedLines, out);
  applyWeakUniqueLinePairs(lines, players, statIndices, usedPlayers, usedLines, out);

  return out;
}

export function normalizeScorecardName(s: string): string {
  return (s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Merge mobile/table OCR rows so each bowler is one line: (1) name-only + numeric row,
 * (2) stats row + bare surname. Otherwise findLineForPlayer often misses "Emmanuel"/"Anil"
 * or anchors on a line with no digits.
 */
export function preprocessBowlingOcrLines(rawLines: string[]): string[] {
  const lines = rawLines.map((l) => l.trim()).filter(Boolean);
  const digitCount = (s: string) => extractOrderedNumbers(sanitizeBowlingOcrLine(s)).length;

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    if (/^bowling[\s:,-]*o[\s:,-]*m[\s:,-]*r/i.test(cur) && digitCount(cur) < 2) {
      continue;
    }

    const next = lines[i + 1];
    if (next !== undefined) {
      const d0 = digitCount(cur);
      const d1 = digitCount(next);
      if (d0 < 2 && d1 >= 4) {
        out.push(`${cur} ${next}`.replace(/\s+/g, ' ').trim());
        i++;
        continue;
      }

      const nextTrim = next.trim();
      const looksLikeBareSurname =
        d0 >= 4 &&
        d1 === 0 &&
        nextTrim.length >= 4 &&
        nextTrim.length <= 40 &&
        /^[A-Za-z][A-Za-z\s.'-]*[A-Za-z]$/.test(nextTrim) &&
        !/\d/.test(nextTrim);

      if (looksLikeBareSurname) {
        out.push(`${cur} ${nextTrim}`.replace(/\s+/g, ' ').trim());
        i++;
        continue;
      }
    }

    out.push(cur);
  }
  return out;
}

/**
 * Longest-first aliases so "anil kumar chandu" matches sheets that only print
 * "Anil Kumar" or "Anil".
 */
export function aliasesForScorecardName(name: string): string[] {
  const n = normalizeScorecardName(stripRoleMarkers(name));
  const parts = n.split(' ').filter((p) => p.length > 0);
  const set = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t.length >= 2) set.add(t);
  };
  add(n);
  if (parts.length >= 2) {
    add(parts.slice(0, -1).join(' '));
    add(`${parts[0]} ${parts[parts.length - 1]}`);
  }
  if (parts.length >= 3) {
    add(parts.slice(0, 2).join(' '));
  }
  /** Pairs of significant tokens (e.g. anil+chandu, kumar+chandu) for OCR that drops a middle name. */
  const sig = parts.filter((p) => p.length >= 3);
  for (let i = 0; i < sig.length; i++) {
    for (let j = i + 1; j < sig.length; j++) {
      add(`${sig[i]} ${sig[j]}`);
    }
  }
  for (const p of sig) {
    if (p.length >= 4) add(p);
  }
  if (parts.length >= 1) {
    add(parts[0]);
  }
  return Array.from(set).sort((a, b) => b.length - a.length);
}

/**
 * Pick the OCR line for this player; avoid reusing a line (claim indices).
 */
export function findLineForPlayer(
  lines: string[],
  playerDisplayName: string,
  claimed: Set<number>,
): { line: string; lineIndex: number } | null {
  const lowerLines = lines.map((l) => l.toLowerCase());
  const aliases = aliasesForScorecardName(playerDisplayName);

  for (const alias of aliases) {
    if (alias.length < 3) continue;
    for (let i = 0; i < lines.length; i++) {
      if (claimed.has(i)) continue;
      if (lowerLines[i].includes(alias)) {
        return { line: lines[i], lineIndex: i };
      }
    }
  }

  const parts = normalizeScorecardName(stripRoleMarkers(playerDisplayName)).split(' ').filter(Boolean);
  const first = parts[0];
  if (first && first.length >= 4) {
    for (let i = 0; i < lines.length; i++) {
      if (claimed.has(i)) continue;
      if (lowerLines[i].includes(first)) {
        return { line: lines[i], lineIndex: i };
      }
    }
  }

  if (first && first.length >= 2) {
    for (let i = 0; i < lines.length; i++) {
      if (claimed.has(i)) continue;
      if (lowerLines[i].includes(first)) {
        return { line: lines[i], lineIndex: i };
      }
    }
  }

  // Short aliases (2 chars) e.g. "Jo" on crowded sheets — use only when unique
  for (const alias of aliases) {
    if (alias.length !== 2) continue;
    const hits: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (claimed.has(i)) continue;
      if (lowerLines[i].includes(alias)) hits.push(i);
    }
    if (hits.length === 1) {
      const i = hits[0];
      return { line: lines[i], lineIndex: i };
    }
  }

  /** Token overlap when OCR mangles spacing / order / a few characters */
  const tokens = parts.filter((t) => t.length >= 2);
  if (tokens.length > 0) {
    const need = tokens.length === 1 ? 1 : Math.max(2, Math.ceil(tokens.length / 2));
    let bestI = -1;
    let bestScore = -1;
    for (let i = 0; i < lines.length; i++) {
      if (claimed.has(i)) continue;
      const lineRaw = lines[i];
      const lineNorm = normalizeScorecardName(lineRaw);
      const oWords = lineNorm.split(' ').filter(Boolean);
      const hitCount = tokens.filter(
        (t) =>
          lineRaw.toLowerCase().includes(t) ||
          (t.length >= 3 && rosterTokenAppearsInOcrText(t, lineNorm, oWords)),
      ).length;
      const score = tokens.reduce((acc, t) => {
        const hit =
          lineRaw.toLowerCase().includes(t) ||
          (t.length >= 3 && rosterTokenAppearsInOcrText(t, lineNorm, oWords));
        return acc + (hit ? t.length : 0);
      }, 0);
      if (hitCount >= need && score > bestScore) {
        bestScore = score;
        bestI = i;
      }
    }
    if (bestI >= 0) {
      return { line: lines[bestI], lineIndex: bestI };
    }
  }

  return null;
}

/**
 * Like findLineForPlayer, but fixes common bowling-sheet layouts:
 * - Stats on one line, **surname alone** on the next (e.g. "Emmanuel Jacob 1.0 …" then "Kanagala").
 *   A plain last-name match would anchor on the empty "Kanagala" row; use the **previous** line instead.
 */
export function findBowlingLineForPlayer(
  lines: string[],
  playerDisplayName: string,
  claimed: Set<number>,
): BowlingLineHit | null {
  const hit = findLineForPlayer(lines, playerDisplayName, claimed);
  if (!hit) return null;

  const digitsOnLine = (s: string) => extractOrderedNumbers(sanitizeBowlingOcrLine(s)).length;
  let line = hit.line;
  let lineIndex = hit.lineIndex;
  const claimExtra: number[] = [];

  if (digitsOnLine(line) >= 2) {
    const sc = scoreRosterAgainstFullBowlingLine(playerDisplayName, line);
    if (sc < BOWLING_FALLBACK_MIN_SCORE) return null;
    return { line, lineIndex, claimExtra };
  }

  const parts = normalizeScorecardName(stripRoleMarkers(playerDisplayName)).split(' ').filter(Boolean);
  const last = parts[parts.length - 1];
  const first = parts[0];
  const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
  const lineComp = compact(line);

  const looksLikeBareSurname =
    last &&
    last.length >= 3 &&
    first &&
    (lineComp === compact(last) || line.toLowerCase().trim() === last.toLowerCase());

  if (looksLikeBareSurname) {
    const prevI = lineIndex - 1;
    if (prevI >= 0 && !claimed.has(prevI)) {
      const prevLine = lines[prevI];
      if (prevLine.toLowerCase().includes(first) && digitsOnLine(prevLine) >= 2) {
        const combined = `${extractBowlingNamePrefixBeforeStats(prevLine)} ${line.trim()}`
          .replace(/\s+/g, ' ')
          .trim();
        const sc = Math.max(
          scoreRosterNameAgainstBowlingOcrPrefix(playerDisplayName, combined),
          scoreRosterAgainstFullBowlingLine(playerDisplayName, prevLine),
        );
        if (sc < BOWLING_FALLBACK_MIN_SCORE - 4) return null;
        claimExtra.push(lineIndex);
        return { line: prevLine, lineIndex: prevI, claimExtra };
      }
    }
  }

  const weak = scoreRosterAgainstFullBowlingLine(playerDisplayName, line);
  if (weak < BOWLING_FALLBACK_MIN_SCORE - 8) return null;
  return { line, lineIndex, claimExtra };
}

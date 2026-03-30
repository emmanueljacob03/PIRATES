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
  }

  if (rParts.length >= 2) {
    const longToks = rParts.filter((t) => t.length >= 3);
    const hit = longToks.filter((t) => ocr.includes(t)).length;
    const need =
      longToks.length <= 1 ? 1 : Math.max(2, Math.ceil(longToks.length * 0.5));
    if (longToks.length > 0 && hit >= need) bump(76 + hit * 5);
  }

  if (oParts.length >= 2 && rParts.length >= 2) {
    const olap = oParts.filter((t) => t.length >= 3 && roster.includes(t)).length;
    if (olap >= 2) bump(80 + olap * 6);
  }

  return Math.min(100, Math.round(best * 10) / 10);
}

const BOWLING_GREEDY_MIN_SCORE = 76;
const BOWLING_FALLBACK_MIN_SCORE = 52;

type GreedyBowlingPair = {
  playerId: string;
  lineIndex: number;
  score: number;
};

/**
 * Parse each OCR row into (name prefix, stats) and **globally** assign lines to squad players
 * (highest confidence first, one line per player) so row order gaps do not mis-attach stats.
 */
export function matchBowlingStatLinesToPlayersGreedy(
  lines: string[],
  players: { id: string; name: string }[],
): Map<string, BowlingLineHit> {
  const out = new Map<string, BowlingLineHit>();
  const digitsOnLine = (s: string) => extractOrderedNumbers(sanitizeBowlingOcrLine(s)).length;

  const statIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (digitsOnLine(lines[i]!) < 4) continue;
    const prefix = extractBowlingNamePrefixBeforeStats(lines[i]!);
    if (isJunkBowlingNamePrefix(normalizeScorecardName(prefix))) continue;
    if (prefix.replace(/[^A-Za-z]/g, '').length < 2) continue;
    statIndices.push(i);
  }

  const pairs: GreedyBowlingPair[] = [];
  for (const lineIndex of statIndices) {
    const prefix = extractBowlingNamePrefixBeforeStats(lines[lineIndex]!);
    for (const pl of players) {
      const score = scoreRosterNameAgainstBowlingOcrPrefix(pl.name, prefix);
      if (score >= BOWLING_GREEDY_MIN_SCORE) {
        pairs.push({ playerId: pl.id, lineIndex, score });
      }
    }
  }

  pairs.sort((a, b) => b.score - a.score);
  const usedLines = new Set<number>();
  const usedPlayers = new Set<string>();

  for (const p of pairs) {
    if (usedPlayers.has(p.playerId) || usedLines.has(p.lineIndex)) continue;
    usedPlayers.add(p.playerId);
    usedLines.add(p.lineIndex);
    out.set(p.playerId, {
      line: lines[p.lineIndex]!,
      lineIndex: p.lineIndex,
      claimExtra: [],
    });
  }

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

  /** Token overlap when OCR mangles spacing / order of words */
  const tokens = parts.filter((t) => t.length >= 2);
  if (tokens.length > 0) {
    const need = tokens.length === 1 ? 1 : Math.max(2, Math.ceil(tokens.length / 2));
    let bestI = -1;
    let bestScore = -1;
    for (let i = 0; i < lines.length; i++) {
      if (claimed.has(i)) continue;
      const line = lowerLines[i];
      const score = tokens.reduce((acc, t) => acc + (line.includes(t) ? t.length : 0), 0);
      const hitCount = tokens.filter((t) => line.includes(t)).length;
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
    const sc = scoreRosterNameAgainstBowlingOcrPrefix(
      playerDisplayName,
      extractBowlingNamePrefixBeforeStats(line),
    );
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
        const sc = scoreRosterNameAgainstBowlingOcrPrefix(playerDisplayName, combined);
        if (sc < BOWLING_FALLBACK_MIN_SCORE - 4) return null;
        claimExtra.push(lineIndex);
        return { line: prevLine, lineIndex: prevI, claimExtra };
      }
    }
  }

  const weak = scoreRosterNameAgainstBowlingOcrPrefix(
    playerDisplayName,
    extractBowlingNamePrefixBeforeStats(line),
  );
  if (weak < BOWLING_FALLBACK_MIN_SCORE - 8) return null;
  return { line, lineIndex, claimExtra };
}

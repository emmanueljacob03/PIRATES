import { stripRoleMarkers } from '@/lib/batting-ocr';

export function normalizeScorecardName(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
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

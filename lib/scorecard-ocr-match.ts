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

  return null;
}

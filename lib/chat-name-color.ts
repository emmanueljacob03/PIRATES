/** Stable display color per user for chat names (dark bubble backgrounds). Large palette to reduce collisions. */

const PALETTE = [
  '#5eead4',
  '#93c5fd',
  '#f9a8d4',
  '#fde047',
  '#c4b5fd',
  '#86efac',
  '#fdba74',
  '#67e8f9',
  '#fcd34d',
  '#a5b4fc',
  '#f0abfc',
  '#bef264',
  '#38bdf8',
  '#fb923c',
  '#f472b6',
  '#4ade80',
  '#818cf8',
  '#2dd4bf',
  '#fbbf24',
  '#e879f9',
  '#34d399',
  '#60a5fa',
  '#fca5a5',
  '#c084fc',
  '#a78bfa',
  '#22d3ee',
  '#fb7185',
  '#a3e635',
  '#7dd3fc',
  '#facc15',
  '#e9d5ff',
  '#99f6e4',
  '#fecdd3',
  '#bfdbfe',
  '#fde68a',
  '#d8b4fe',
  '#6ee7b7',
  '#7c3aed',
  '#0ea5e9',
  '#ec4899',
  '#14b8a6',
  '#eab308',
  '#8b5cf6',
  '#f43f5e',
  '#10b981',
  '#6366f1',
  '#f59e0b',
  '#d946ef',
  '#06b6d4',
] as const;

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic pastel-ish color per user id (spread across palette). */
export function chatNameColorForUser(userId: string): string {
  const h = hashString(userId);
  const idx = h % PALETTE.length;
  return PALETTE[idx]!;
}

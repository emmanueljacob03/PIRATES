/** Stable display color per user for chat names (dark bubble backgrounds). */

const PALETTE = [
  '#5eead4', // teal-300
  '#93c5fd', // blue-300
  '#f9a8d4', // pink-300
  '#fde047', // yellow-300
  '#c4b5fd', // violet-300
  '#86efac', // green-300
  '#fdba74', // orange-300
  '#67e8f9', // cyan-300
  '#fcd34d', // amber-300
  '#a5b4fc', // indigo-300
  '#f0abfc', // fuchsia-300
  '#bef264', // lime-300
] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function chatNameColorForUser(userId: string): string {
  const idx = hashString(userId) % PALETTE.length;
  return PALETTE[idx]!;
}

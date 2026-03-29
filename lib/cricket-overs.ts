/**
 * Cricket "dot" overs: whole overs + balls 0–5 in the current over (e.g. 1.4 = 10 balls).
 */

/** Legal balls bowled from stored overs (handles float noise). */
export function dotOversToTotalBalls(oversDot: number): number {
  if (!oversDot || oversDot <= 0 || !Number.isFinite(oversDot)) return 0;
  const whole = Math.floor(oversDot + 1e-9);
  const frac = oversDot - whole;
  const ballDigit = Math.max(0, Math.min(5, Math.round(frac * 10 + 1e-9)));
  return whole * 6 + ballDigit;
}

export function totalBallsToDotOvers(totalBalls: number): number {
  if (!Number.isFinite(totalBalls) || totalBalls <= 0) return 0;
  const whole = Math.floor(totalBalls / 6);
  const rem = totalBalls % 6;
  return Math.round((whole + rem / 10) * 100) / 100;
}

/** Carry ball digit into overs when user types e.g. 1.7 → 2.1 */
export function normalizeDotOversInput(raw: number): number {
  if (!Number.isFinite(raw) || raw < 0) return 0;
  let whole = Math.floor(raw + 1e-9);
  let ballDigit = Math.round((raw - whole) * 10 + 1e-9);
  while (ballDigit > 5) {
    whole += 1;
    ballDigit -= 6;
  }
  while (ballDigit < 0 && whole > 0) {
    whole -= 1;
    ballDigit += 6;
  }
  if (whole < 0) return 0;
  return Math.round((whole + ballDigit / 10) * 100) / 100;
}

/** Stable string for <input> (avoids 1.399999). */
export function formatDotOversForInput(oversDot: number): string {
  const n = normalizeDotOversInput(oversDot);
  if (n <= 0) return '0';
  const whole = Math.floor(n + 1e-9);
  const d = Math.round((n - whole) * 10 + 1e-9);
  if (d === 0) return String(whole);
  return `${whole}.${d}`;
}

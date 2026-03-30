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

/**
 * Map HTML number input / spinner value to dot-overs given the previous value.
 * Browsers step by 0.1 in “real” decimals (2.0 → 1.9). Normalising 1.9 as cricket
 * overs treats .9 as 9 balls and carries to 2.3 — overs go up instead of down.
 * When the float dropped but implied balls increased and the tenths digit is 7–9
 * (invalid as a single ball count 0–5), step one ball down instead.
 */
export function dotOversFromNumberInput(prevDot: number, rawFloat: number): number {
  if (!Number.isFinite(rawFloat) || rawFloat < 0) return 0;
  const norm = normalizeDotOversInput(rawFloat);
  const prevBalls = dotOversToTotalBalls(prevDot);
  const candBalls = dotOversToTotalBalls(norm);
  const whole = Math.floor(rawFloat + 1e-9);
  const ballDigit = Math.round((rawFloat - whole) * 10 + 1e-9);
  if (rawFloat < prevDot - 1e-6 && candBalls > prevBalls && ballDigit >= 7 && ballDigit <= 9) {
    return totalBallsToDotOvers(Math.max(0, prevBalls - 1));
  }
  if (rawFloat > prevDot + 1e-6 && candBalls < prevBalls) {
    return totalBallsToDotOvers(prevBalls + 1);
  }
  return norm;
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

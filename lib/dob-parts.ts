/** Days in month; `month` is 1–12. */
export function daysInMonth(year: number, month1to12: number): number {
  if (month1to12 < 1 || month1to12 > 12) return 31;
  return new Date(year, month1to12, 0).getDate();
}

/** Returns `YYYY-MM-DD` or `null` if incomplete or invalid. */
export function combineDobParts(
  yStr: string,
  mStr: string,
  dStr: string,
  opts?: { maxYear?: number },
): string | null {
  const y = parseInt(yStr.trim(), 10);
  const m = parseInt(mStr.trim(), 10);
  const d = parseInt(dStr.trim(), 10);
  const maxYear = opts?.maxYear ?? new Date().getFullYear();
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (y < 1900 || y > maxYear) return null;
  if (m < 1 || m > 12) return null;
  const dim = daysInMonth(y, m);
  if (d < 1 || d > dim) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

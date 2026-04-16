/** True if stored value means "paid" (Postgres bool + PostgREST / JSON edge shapes). */
export function isPaid(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (value === 1) return true;
  if (value === 0) return false;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (['true', 't', '1', 'yes', 'y'].includes(s)) return true;
    if (['false', 'f', '0', 'no', 'n', ''].includes(s)) return false;
    return false;
  }
  return false;
}

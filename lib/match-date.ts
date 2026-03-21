import { format } from 'date-fns';

/** User's (or passed-in Date's) local calendar as YYYY-MM-DD — use for API ranges from the browser. */
export function toLocalYmdFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Stable YYYY-MM-DD from Supabase DATE or ISO (`2026-02-20T00:00:00.000Z`) in **local** calendar terms.
 */
export function normalizeMatchDateYmd(dateStr: string | null | undefined): string {
  if (dateStr == null || dateStr === '') return '';
  const s = String(dateStr).trim();
  const head = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return toLocalYmdFromDate(d);
  return '';
}

/**
 * Calendar DATE from Postgres (YYYY-MM-DD) must not use `new Date(str)` — that is UTC midnight
 * and shows as the previous calendar day in US timezones.
 */
export function parseMatchDateOnly(dateStr: string | null | undefined): Date {
  const ymd = normalizeMatchDateYmd(dateStr);
  if (!ymd) return new Date(NaN);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return new Date(NaN);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(y, mo, d);
}

export function parseMatchTimeParts(timeStr: string | null | undefined): { h: number; min: number; sec: number } {
  const raw = String(timeStr ?? '00:00').trim();
  if (!raw) return { h: 0, min: 0, sec: 0 };

  // Convert dot-form times like `1.00 PM` / `14.00` into `1:00 PM` / `14:00`.
  // Keep AM/PM detection working, but avoid removing the dot that acts like a separator.
  const normalized = raw
    .replace(/(\d)\.(\d)/g, '$1:$2')
    .replace(/\s+/g, ' ')
    .trim();

  // `1PM`, `1 PM`, `1pm` (no colon) — otherwise we wrongly fall back to midnight.
  const ampmOnly = /^(\d{1,2})\s*(AM|PM)\s*$/i.exec(normalized);
  if (ampmOnly) {
    let h = Number(ampmOnly[1]);
    const ap = ampmOnly[2].toUpperCase();
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    if (h < 0 || h > 23) return { h: 0, min: 0, sec: 0 };
    return { h, min: 0, sec: 0 };
  }

  const upper = normalized.toUpperCase();
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(normalized);
  if (!m) return { h: 0, min: 0, sec: 0 };
  let h = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] != null ? Number(m[3]) : 0;
  // `2:00 PM`, `2:00PM` — HTML time inputs still use 24h `14:00`; handle both.
  if (upper.includes('PM') && h < 12) h += 12;
  if (upper.includes('AM') && h === 12) h = 0;
  return { h, min, sec };
}

export function formatMatchDate(dateStr: string | null | undefined, pattern = 'EEE, MMM d') {
  return format(parseMatchDateOnly(dateStr), pattern);
}

/**
 * Combine DB date (YYYY-MM-DD) + time text (e.g. `14:00`, `2:00 PM`) in **local** timezone.
 */
export function parseMatchDateTimeLocal(dateStr: string, timeStr: string | null | undefined): Date {
  const base = parseMatchDateOnly(dateStr);
  if (isNaN(base.getTime())) return base;
  const { h, min, sec } = parseMatchTimeParts(timeStr);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, min, sec, 0);
}

/**
 * Upcoming matches: local `now` → end of the calendar day **today + lastDayOffsetFromToday**.
 * (Rolling “168 hours” can drop same-day / next-day events around DST; this matches the schedule list.)
 */
export function filterUpcomingMatchesInCalendarWindow<T extends { date: string; time: string }>(
  matches: readonly T[],
  now: Date = new Date(),
  lastDayOffsetFromToday: number = 7,
): T[] {
  const nowMs = now.getTime();
  const endBoundary = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  endBoundary.setDate(endBoundary.getDate() + lastDayOffsetFromToday);
  endBoundary.setHours(23, 59, 59, 999);
  const endMs = endBoundary.getTime();

  const out = matches.filter((m) => {
    const start = parseMatchDateTimeLocal(m.date, m.time);
    if (isNaN(start.getTime())) return false;
    const t = start.getTime();
    return t >= nowMs && t <= endMs;
  });
  out.sort(
    (a, b) =>
      parseMatchDateTimeLocal(a.date, a.time).getTime() -
      parseMatchDateTimeLocal(b.date, b.time).getTime(),
  );
  return out;
}

/** Matches whose scheduled local start is within the next `hours` hours (inclusive of now). */
export function filterMatchesWithinNextHours<T extends { date: string; time: string }>(
  matches: readonly T[],
  hours: number,
  now: Date = new Date(),
): T[] {
  const msStart = now.getTime();
  const msEnd = msStart + hours * 60 * 60 * 1000;
  const out = matches.filter((m) => {
    const start = parseMatchDateTimeLocal(m.date, m.time);
    if (isNaN(start.getTime())) return false;
    const t = start.getTime();
    return t >= msStart && t <= msEnd;
  });
  out.sort(
    (a, b) =>
      parseMatchDateTimeLocal(a.date, a.time).getTime() -
      parseMatchDateTimeLocal(b.date, b.time).getTime(),
  );
  return out;
}

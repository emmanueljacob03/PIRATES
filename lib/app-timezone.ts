import { DateTime } from 'luxon';
import { normalizeMatchDateYmd, parseMatchTimeParts } from '@/lib/match-date';

/**
 * US Central Time (CST/CDT). All match dates + times in the DB are treated as wall-clock in this zone.
 */
export const APP_TIME_ZONE = 'America/Chicago';

/** Short label for UI (DST is handled automatically). */
export const APP_TIME_ZONE_SHORT = 'Central Time';

/** e.g. "Wed, Mar 15 · 2:30 PM" in America/Chicago */
export function formatCentralNow(now: Date = new Date(), pattern = 'ccc, LLL d · h:mm a'): string {
  return DateTime.fromJSDate(now, { zone: APP_TIME_ZONE }).toFormat(pattern);
}

/** “Today” date string (YYYY-MM-DD) in app timezone. */
export function toAppZonedYmdFromDate(now: Date = new Date()): string {
  return DateTime.fromJSDate(now, { zone: APP_TIME_ZONE }).toFormat('yyyy-MM-dd');
}

/** Playing 11 + “Playing 11 added” reminders stay visible until this long after scheduled start (Central). */
export const PLAYING11_VISIBILITY_HOURS_AFTER_START = 4;

/**
 * Whether Playing 11 lineup / badge should still be shown (before start through N hours after start).
 * After match start + {@link PLAYING11_VISIBILITY_HOURS_AFTER_START}, treat lineup as cleared for UI/notifications.
 */
export function isWithinPlaying11VisibilityWindow(
  dateStr: string,
  timeStr: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const start = parseMatchStartInAppTimezone(dateStr, timeStr);
  if (isNaN(start.getTime())) return false;
  const endMs = start.getTime() + PLAYING11_VISIBILITY_HOURS_AFTER_START * 60 * 60 * 1000;
  return now.getTime() <= endMs;
}

/** Instant when the scheduled local clock in app TZ is `date` + `time`. */
export function parseMatchStartInAppTimezone(
  dateStr: string,
  timeStr: string | null | undefined,
): Date {
  const ymd = normalizeMatchDateYmd(dateStr);
  if (!ymd) return new Date(NaN);
  const y = Number(ymd.slice(0, 4));
  const mo = Number(ymd.slice(5, 7));
  const d = Number(ymd.slice(8, 10));
  const { h, min, sec } = parseMatchTimeParts(timeStr);
  const dt = DateTime.fromObject(
    { year: y, month: mo, day: d, hour: h, minute: min, second: sec },
    { zone: APP_TIME_ZONE },
  );
  if (!dt.isValid) return new Date(NaN);
  return dt.toJSDate();
}

/** End of calendar day `(start of "today" in app TZ) + offsetDays`, as JS Date (UTC instant). */
export function endOfDayPlusOffsetAppTimezone(now: Date, offsetDays: number): Date {
  return DateTime.fromJSDate(now, { zone: APP_TIME_ZONE })
    .startOf('day')
    .plus({ days: offsetDays })
    .endOf('day')
    .toJSDate();
}

/**
 * Matches whose start (interpreted in **America/Chicago**) falls between **now** (UTC instant)
 * and end of **today + lastDayOffset** in Chicago.
 */
export function filterUpcomingMatchesInAppTimezone<T extends { date: string; time: string }>(
  matches: readonly T[],
  now: Date = new Date(),
  lastDayOffsetFromToday: number = 7,
): T[] {
  const nowMs = now.getTime();
  const endMs = endOfDayPlusOffsetAppTimezone(now, lastDayOffsetFromToday).getTime();
  const out = matches.filter((m) => {
    const start = parseMatchStartInAppTimezone(m.date, m.time);
    if (isNaN(start.getTime())) return false;
    const t = start.getTime();
    return t >= nowMs && t <= endMs;
  });
  out.sort(
    (a, b) =>
      parseMatchStartInAppTimezone(a.date, a.time).getTime() -
      parseMatchStartInAppTimezone(b.date, b.time).getTime(),
  );
  return out;
}

/**
 * Rolling window: event start in **[now, now + hours]** (interpreted with **America/Chicago** wall times).
 * Used for ~72h / “next 3 days” reminders.
 */
export function filterMatchesWithinNextHoursAppTimezone<T extends { date: string; time: string }>(
  matches: readonly T[],
  hours: number,
  now: Date = new Date(),
): T[] {
  const nowMs = now.getTime();
  const endMs = nowMs + hours * 60 * 60 * 1000;
  const out = matches.filter((m) => {
    const start = parseMatchStartInAppTimezone(m.date, m.time);
    if (isNaN(start.getTime())) return false;
    const t = start.getTime();
    return t >= nowMs && t <= endMs;
  });
  out.sort(
    (a, b) =>
      parseMatchStartInAppTimezone(a.date, a.time).getTime() -
      parseMatchStartInAppTimezone(b.date, b.time).getTime(),
  );
  return out;
}

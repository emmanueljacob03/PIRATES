import { DateTime } from 'luxon';
import { formatMatchDate } from '@/lib/match-date';
import { APP_TIME_ZONE, filterMatchesWithinNextHoursAppTimezone } from '@/lib/app-timezone';

/**
 * Chicago calendar days to query (inclusive `end`). Use a full week so match rows on later
 * calendar days (e.g. 20th & 21st) are never missing from the API while the 72h client filter
 * still controls what shows in notifications.
 */
export const UPCOMING_FETCH_DAY_RANGE = 7;

/** ≈3 days — sliding notifications + bell only show starts within this window (Central wall time). */
export const REMINDER_WINDOW_HOURS = 72;

/** @deprecated use {@link UPCOMING_FETCH_DAY_RANGE} */
export const UPCOMING_NOTIFICATION_DAY_RANGE = UPCOMING_FETCH_DAY_RANGE;
export const UPCOMING_FETCH_END_OFFSET_DAYS = UPCOMING_FETCH_DAY_RANGE;

/** Build `start`/`end` for `/api/upcoming-matches` (Chicago calendar). */
export function buildUpcomingMatchesSearchParams(now: Date = new Date()): URLSearchParams {
  const z = DateTime.fromJSDate(now, { zone: APP_TIME_ZONE }).startOf('day');
  const start = z.toFormat('yyyy-MM-dd');
  const end = z.plus({ days: UPCOMING_FETCH_DAY_RANGE }).toFormat('yyyy-MM-dd');
  return new URLSearchParams({ start, end });
}

/** Bell + sliding reminders: matches/practices whose start is within the next **72 hours** (Central). */
export function selectMatchesForReminderWindow<T extends { date: string; time: string }>(
  raw: readonly T[],
  now: Date = new Date(),
): T[] {
  return filterMatchesWithinNextHoursAppTimezone(raw, REMINDER_WINDOW_HOURS, now);
}

/** One line for bell / slider (Central dates from DB `date` + `time`). */
export function formatReminderLine(m: {
  date: string;
  time: string;
  opponent: string;
  is_practice?: boolean;
  playing11_added?: boolean;
}): string {
  if (m.is_practice) {
    return `Practice — ${formatMatchDate(m.date, 'MMM d, yyyy')} · ${m.time}`;
  }
  if (m.playing11_added) {
    return `Match vs ${m.opponent} — ${formatMatchDate(m.date, 'MMM d, yyyy')} · ${m.time} · New Playing 11 added`;
  }
  return `Match vs ${m.opponent} — ${formatMatchDate(m.date, 'MMM d, yyyy')} · ${m.time}`;
}

/** @deprecated use {@link selectMatchesForReminderWindow} */
export function selectMatchesForNotificationWindow<T extends { date: string; time: string }>(
  raw: readonly T[],
  now: Date = new Date(),
): T[] {
  return selectMatchesForReminderWindow(raw, now);
}

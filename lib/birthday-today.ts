import { DateTime } from 'luxon';
import { APP_TIME_ZONE } from '@/lib/app-timezone';

/** `date_of_birth` from DB as `YYYY-MM-DD` (DATE). True if month/day matches “today” in app timezone. */
export function isBirthdayToday(dobYmd: string | null | undefined, now: Date = new Date()): boolean {
  if (!dobYmd || typeof dobYmd !== 'string') return false;
  const raw = dobYmd.slice(0, 10);
  const birth = DateTime.fromISO(raw, { zone: APP_TIME_ZONE });
  if (!birth.isValid) return false;
  const today = DateTime.fromJSDate(now, { zone: APP_TIME_ZONE });
  return birth.month === today.month && birth.day === today.day;
}

import { parseMatchStartInAppTimezone } from '@/lib/app-timezone';

/** Scheduled instant from DB date + wall time interpreted in America/Chicago (same as matches / schedule UI). */
export function dutyScheduledStartMs(dutyDate: string, dutyTime?: string | null): number {
  const time = dutyTime?.trim() ? dutyTime.trim() : '12:00';
  const js = parseMatchStartInAppTimezone(dutyDate, time);
  const t = js.getTime();
  return Number.isFinite(t) ? t : Date.now();
}

/** After scheduled time + 4 hours, duty is "completed" (green, player back in dropdown). */
export function isUmpiringDutyCompleted(dutyDate: string, dutyTime?: string | null): boolean {
  const start = dutyScheduledStartMs(dutyDate, dutyTime);
  return Date.now() >= start + 4 * 60 * 60 * 1000;
}

/** Match or practice is "finished" for schedule UI: same 4h rule — hide weather, etc. */
export function isScheduleFinishedAfterFourHours(date: string, time?: string | null): boolean {
  return isUmpiringDutyCompleted(date, time);
}

/** True from 72h before scheduled duty until duty start (reminder window for profile banner). */
export function isWithinThreeDaysBeforeUmpiringDuty(dutyDate: string, dutyTime?: string | null): boolean {
  const start = dutyScheduledStartMs(dutyDate, dutyTime);
  const now = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  return now >= start - threeDaysMs && now < start;
}

export type UmpiringDutyLike = {
  id: string;
  who: string;
  duty_date: string;
  duty_time?: string | null;
  player_id?: string | null;
};

/** Player is unavailable in the add dropdown if they have a duty that is not yet completed (unless editing that row). */
export function playerHasActiveUmpiringDuty(
  playerId: string,
  rosterName: string,
  duties: UmpiringDutyLike[],
  excludeDutyId?: string | null,
): boolean {
  return duties.some((d) => {
    if (excludeDutyId && d.id === excludeDutyId) return false;
    if (isUmpiringDutyCompleted(d.duty_date, d.duty_time)) return false;
    if (d.player_id === playerId) return true;
    if (!d.player_id) {
      const a = (rosterName ?? '').trim().toLowerCase();
      const b = (d.who ?? '').trim().toLowerCase();
      return a.length > 0 && (b === a || b.includes(a));
    }
    return false;
  });
}

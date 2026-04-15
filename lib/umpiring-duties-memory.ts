/** In-memory fallback when DB is unavailable (e.g. local demo). Shared across API routes. */
export type MemoryDuty = {
  id: string;
  who: string;
  duty_date: string;
  duty_time: string;
  notes: string;
  player_id: string | null;
};

export const memoryDuties: MemoryDuty[] = [];

export function nextMemoryDutyId() {
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

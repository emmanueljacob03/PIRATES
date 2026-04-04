import type { Jersey } from '@/types/database';

export type JerseyRow = Jersey & { submitter_name?: string | null };

/** Strip [new]/[existing] prefix from stored notes for display. */
export function stripJerseyRequestNotePrefix(notes: string | null | undefined): string {
  if (!notes) return '';
  return notes.replace(/^\[(?:new|existing)\]\s*/i, '').trim();
}

/** CSV / display: long sleeve only if comments mention it; otherwise short sleeve. */
export function sleeveSizeFromNotes(notes: string | null | undefined): string {
  const stripped = stripJerseyRequestNotePrefix(notes);
  const combined = `${stripped} ${notes ?? ''}`.toLowerCase();
  if (/\blong[\s-]*sleeve\b/.test(combined)) return 'Long sleeve';
  return 'Short sleeve';
}

export function sortJerseysByNumber(a: Jersey, b: Jersey): number {
  const sa = String(a.jersey_number ?? '');
  const sb = String(b.jersey_number ?? '');
  const na = parseInt(sa, 10);
  const nb = parseInt(sb, 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return sa.localeCompare(sb, undefined, { numeric: true });
}

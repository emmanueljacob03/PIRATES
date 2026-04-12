import type { Jersey } from '@/types/database';

/** USD per unpaid new jersey (UI copy + pending totals). */
export const NEW_JERSEY_AMOUNT_USD = 16;

export type JerseyRow = Jersey & { submitter_name?: string | null };

/** Strip [new]/[existing] prefix from stored notes for display. */
export function stripJerseyRequestNotePrefix(notes: string | null | undefined): string {
  if (!notes) return '';
  return notes.replace(/^\[(?:new|existing)\]\s*/i, '').trim();
}

/** Jersey request form stores `[new]` or `[existing]` prefix on notes. */
export function isJerseyNewRequest(notes: string | null | undefined): boolean {
  return /^\[\s*new\s*\]/i.test((notes ?? '').trim());
}

/**
 * Sleeve for CSV: `full` if notes (after stripping tag) mention long/full sleeve; otherwise `half`.
 */
export function sleeveAbbrevFromNotes(notes: string | null | undefined): 'full' | 'half' {
  const stripped = stripJerseyRequestNotePrefix(notes);
  const combined = `${stripped} ${notes ?? ''}`.toLowerCase();
  if (
    /\blong[\s-]*sleeve\b/.test(combined) ||
    /\bfull[\s-]*sleeves?\b/.test(combined) ||
    /\bfull\s+sleeve\b/.test(combined)
  ) {
    return 'full';
  }
  return 'half';
}

/** Longer label if needed elsewhere. */
export function sleeveSizeFromNotes(notes: string | null | undefined): string {
  return sleeveAbbrevFromNotes(notes) === 'full' ? 'Long sleeve' : 'Short sleeve';
}

export function sortJerseysByNumber(a: Jersey, b: Jersey): number {
  const sa = String(a.jersey_number ?? '');
  const sb = String(b.jersey_number ?? '');
  const na = parseInt(sa, 10);
  const nb = parseInt(sb, 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return sa.localeCompare(sb, undefined, { numeric: true });
}

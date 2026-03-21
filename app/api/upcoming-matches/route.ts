import { NextRequest, NextResponse } from 'next/server';
import { DateTime } from 'luxon';

/** Uses `cookies()` — must not be statically optimized (fixes Vercel/Next build prerender errors). */
export const dynamic = 'force-dynamic';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { differenceInCalendarDays } from 'date-fns';
import { createAdminSupabase } from '@/lib/supabase-admin';
import type { Database } from '@/types/database';
import { parseMatchDateOnly } from '@/lib/match-date';
import { APP_TIME_ZONE, isWithinPlaying11VisibilityWindow } from '@/lib/app-timezone';
import { REQUIRED_PLAYING11_COUNT } from '@/lib/playing11-config';

/**
 * Same Supabase access pattern as `app/(dashboard)/schedule/page.tsx`:
 * after team code is verified we use the service client so data isn’t blocked by RLS when
 * the browser session isn’t attached to this route the same way (notifications were always empty).
 */
async function supabaseForMatchesRead() {
  const cookieStore = await cookies();
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';
  if (codeVerified) {
    try {
      return createAdminSupabase();
    } catch {
      // fall through — e.g. local dev without service role key
    }
  }
  return createRouteHandlerClient<Database>({ cookies: () => cookieStore });
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeYmd(s: string | null): string | null {
  if (!s || !YMD_RE.test(s)) return null;
  return s;
}

/**
 * Upcoming list: **start → end** (YYYY-MM-DD). Clients send Chicago-based `start`/`end`;
 * fallback range uses **America/Chicago** “today” (not the server’s local zone).
 */
const DEFAULT_RANGE_DAYS = 7;
const MAX_RANGE_DAYS = 21;

function chicagoDefaultRange(days: number): { startStr: string; endStr: string } {
  const z = DateTime.now().setZone(APP_TIME_ZONE).startOf('day');
  return {
    startStr: z.toFormat('yyyy-MM-dd'),
    endStr: z.plus({ days: days }).toFormat('yyyy-MM-dd'),
  };
}

function rowDateToYmd(date: unknown): string {
  if (date == null) return '';
  if (typeof date === 'string') return date.slice(0, 10);
  if (date instanceof Date && !isNaN(date.getTime())) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(date).slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseForMatchesRead();

    const qStart = normalizeYmd(req.nextUrl.searchParams.get('start'));
    const qEnd = normalizeYmd(req.nextUrl.searchParams.get('end'));

    let startStr: string;
    let endStr: string;

    if (qStart && qEnd && qStart <= qEnd) {
      const span = differenceInCalendarDays(parseMatchDateOnly(qEnd), parseMatchDateOnly(qStart));
      if (span > MAX_RANGE_DAYS) {
        const r = chicagoDefaultRange(DEFAULT_RANGE_DAYS);
        startStr = r.startStr;
        endStr = r.endStr;
      } else {
        startStr = qStart;
        endStr = qEnd;
      }
    } else {
      const r = chicagoDefaultRange(DEFAULT_RANGE_DAYS);
      startStr = r.startStr;
      endStr = r.endStr;
    }

    const { data, error } = await (supabase as any)
      .from('matches')
      // Some environments may not have `is_practice` yet; infer from opponent text.
      .select('id, date, time, opponent')
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date');

    if (error) {
      console.error('[upcoming-matches]', error.message);
      return NextResponse.json([]);
    }

    const list = (data ?? []).map(
      (m: {
        id: string;
        date: unknown;
        time?: string | null;
        opponent?: string;
      }) => ({
        id: m.id,
        date: rowDateToYmd(m.date),
        time: String(m.time ?? '00:00'),
        opponent: m.opponent ?? '',
        is_practice:
          String(m.opponent || '').toLowerCase().includes('practice'),
      }),
    );

    // Attach playing11_added flag for match reminders (not for practice).
    const matchIds: string[] = list.map((m: { id: string }) => m.id);
    let playing11AddedByMatchId: Record<string, boolean> = {};
    let playing11MaxCreatedMs: Record<string, number> = {};
    if (matchIds.length > 0) {
      const { data: lineup, error: lineupErr } = await (supabase as any)
        .from('match_playing11')
        .select('match_id, role, created_at')
        .in('match_id', matchIds);

      if (!lineupErr) {
        const counts: Record<string, number> = {};
        const maxCreatedMs: Record<string, number> = {};
        (lineup ?? []).forEach(
          (r: { match_id: string; role: string; created_at?: string | null }) => {
            if (r.role === 'playing11') {
              counts[r.match_id] = (counts[r.match_id] ?? 0) + 1;
            }
            if (r.created_at) {
              const t = new Date(r.created_at).getTime();
              if (!isNaN(t)) {
                const id = r.match_id;
                if (!(id in maxCreatedMs) || t > maxCreatedMs[id]) maxCreatedMs[id] = t;
              }
            }
          },
        );
        playing11AddedByMatchId = Object.fromEntries(
          matchIds.map((id: string) => [id, (counts[id] ?? 0) >= REQUIRED_PLAYING11_COUNT]),
        );
        playing11MaxCreatedMs = maxCreatedMs;
      }
    }

    const now = new Date();
    const out = list.map(
      (m: { id: string; is_practice: boolean; date: string; time: string }) => {
        const playing11_added =
          !m.is_practice &&
          !!playing11AddedByMatchId[m.id] &&
          isWithinPlaying11VisibilityWindow(m.date, m.time, now);
        const ms = playing11MaxCreatedMs[m.id];
        return {
          ...m,
          playing11_added,
          /** Bumps whenever lineup rows are replaced; clients use this to re-show the slide after edits. */
          playing11_revision:
            playing11_added && ms != null && !isNaN(ms) ? String(ms) : null,
        };
      },
    );

    return NextResponse.json(out);
  } catch (e) {
    console.error('[upcoming-matches]', e);
    return NextResponse.json([]);
  }
}

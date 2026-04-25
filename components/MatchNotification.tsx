'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  buildUpcomingMatchesSearchParams,
  selectMatchesForReminderWindow,
  formatReminderLine,
} from '@/lib/upcoming-notifications';
import { formatCentralNow } from '@/lib/app-timezone';
import { consumeSlideReminderCookieInBrowser } from '@/lib/slide-reminder-cookie';
import { formatMatchDate } from '@/lib/match-date';

type Row = {
  id: string;
  date: string;
  time: string;
  opponent: string;
  is_practice?: boolean;
  playing11_added?: boolean;
  /** Max lineup `created_at` ms as string; changes when admin saves Playing 11. */
  playing11_revision?: string | null;
};

const DISMISS_KEY = 'pirates_reminder_slide_dismissed';
const P11_REV_KEY = 'pirates_p11_revisions';
/** Short interval so viewers see Playing 11 updates without same-tab CustomEvents. */
const REFRESH_MS = 15_000;

function loadDismissedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default function MatchNotification() {
  const [reminderRows, setReminderRows] = useState<Row[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => loadDismissedIds());
  const [centralClock, setCentralClock] = useState('');

  // After login / team code / gate / demo: one-time cookie → show slide (clears session dismiss).
  useEffect(() => {
    try {
      if (consumeSlideReminderCookieInBrowser()) {
        sessionStorage.removeItem(DISMISS_KEY);
        setDismissedIds([]);
      }
    } catch {}
  }, []);

  const load = useCallback(() => {
    const qs = buildUpcomingMatchesSearchParams();
    fetch(`/api/upcoming-matches?${qs}`, { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setReminderRows(selectMatchesForReminderWindow(data, new Date()));
      })
      .catch(() => {});
    setCentralClock(formatCentralNow());
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const handler = (ev: Event) => {
      const ce = ev as CustomEvent<{ matchId?: string }>;
      const mid = ce.detail?.matchId?.trim();
      if (mid) {
        setDismissedIds((prev) => {
          const next = prev.filter((id) => id !== mid);
          try {
            sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next));
          } catch {}
          return next;
        });
      }
      load();
    };
    window.addEventListener('playing11-updated', handler);
    return () => window.removeEventListener('playing11-updated', handler);
  }, [load]);

  // Playing 11 revision changed (admin saved) → re-show that match for viewers and admins.
  useEffect(() => {
    if (reminderRows.length === 0) return;
    try {
      const raw = sessionStorage.getItem(P11_REV_KEY);
      let prev: Record<string, string> = {};
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          prev = parsed as Record<string, string>;
        }
      }

      const next: Record<string, string> = {};
      const toUndismiss = new Set<string>();

      for (const m of reminderRows) {
        if (m.playing11_added && m.playing11_revision) {
          const rev = m.playing11_revision;
          const old = prev[m.id];
          if (old !== rev) {
            toUndismiss.add(m.id);
          }
          next[m.id] = rev;
        }
      }

      sessionStorage.setItem(P11_REV_KEY, JSON.stringify(next));

      if (toUndismiss.size > 0) {
        setDismissedIds((d) => {
          const filtered = d.filter((id) => !toUndismiss.has(id));
          try {
            sessionStorage.setItem(DISMISS_KEY, JSON.stringify(filtered));
          } catch {}
          return filtered;
        });
      }
    } catch {}
  }, [reminderRows]);

  const visible = useMemo(
    () => reminderRows.filter((m) => !dismissedIds.includes(m.id)),
    [reminderRows, dismissedIds],
  );
  const playing11Visible = useMemo(
    () => visible.filter((m) => m.playing11_added && !m.is_practice),
    [visible],
  );
  const regularVisible = useMemo(
    () => visible.filter((m) => !m.playing11_added),
    [visible],
  );

  const dismissAllVisible = (ids: string[]) => {
    setDismissedIds((prev) => {
      const next = Array.from(new Set([...prev, ...ids]));
      try {
        sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  if (visible.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 w-full max-w-sm px-3 sm:px-0"
      role="region"
      aria-label="Upcoming reminders and playing eleven updates"
    >
      <div className="space-y-3">
        {playing11Visible.length > 0 && (
          <div className="relative overflow-hidden rounded-lg border border-fuchsia-400/70 bg-gradient-to-br from-fuchsia-950/70 via-violet-950/70 to-indigo-950/70 p-4 shadow-[0_0_28px_rgba(217,70,239,0.35)]">
            <div className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_20%_20%,rgba(244,114,182,0.22),transparent_42%),radial-gradient(circle_at_85%_85%,rgba(129,140,248,0.22),transparent_45%)]" />
            <div className="relative flex items-start gap-3 pr-8">
              <span className="text-2xl shrink-0" aria-hidden>
                ✨
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-fuchsia-200 tracking-wide uppercase text-xs">Playing 11 Updated</p>
                <p className="text-[11px] text-fuchsia-100/70 mt-0.5">CST now: {centralClock}</p>
                <ul className="mt-3 max-h-44 overflow-y-auto space-y-0 text-sm text-fuchsia-50 leading-snug">
                  {playing11Visible.map((m, i) => (
                    <li key={m.id} className={i > 0 ? 'pt-3 mt-3 border-t border-fuchsia-300/30' : ''}>
                      {`Match vs ${m.opponent} — ${formatMatchDate(m.date, 'MMM d, yyyy')} · ${m.time}`}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {regularVisible.length > 0 && (
          <div className="bg-slate-800 border border-amber-500/50 rounded-lg shadow-xl p-4 relative overflow-hidden">
            <div className="flex items-start gap-3 pr-8">
              <span className="text-2xl shrink-0" aria-hidden>
                🏏
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-amber-400">Reminder</p>
                <p className="text-[11px] text-slate-500 mt-0.5">CST now: {centralClock}</p>
                <ul className="mt-3 max-h-52 overflow-y-auto space-y-0 text-sm text-slate-200 leading-snug">
                  {regularVisible.map((m, i) => (
                    <li
                      key={m.id}
                      className={i > 0 ? 'pt-3 mt-3 border-t border-slate-600/80' : ''}
                    >
                      {formatReminderLine(m)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => dismissAllVisible(visible.map((m) => m.id))}
          className="absolute top-2 right-2 text-slate-400 hover:text-white text-xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700/80"
          aria-label="Dismiss reminders"
        >
          ×
        </button>
      </div>
    </div>
  );
}

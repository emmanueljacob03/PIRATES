'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  buildUpcomingMatchesSearchParams,
  selectMatchesForReminderWindow,
  formatReminderLine,
} from '@/lib/upcoming-notifications';
import { formatCentralNow } from '@/lib/app-timezone';
import { consumeSlideReminderCookieInBrowser } from '@/lib/slide-reminder-cookie';

type Row = {
  id: string;
  date: string;
  time: string;
  opponent: string;
  is_practice?: boolean;
  playing11_added?: boolean;
};

const DISMISS_KEY = 'pirates_reminder_slide_dismissed';
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

  const visible = useMemo(
    () => reminderRows.filter((m) => !m.playing11_added && !dismissedIds.includes(m.id)),
    [reminderRows, dismissedIds],
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
      aria-label="Upcoming match and practice reminders"
    >
      <div className="bg-slate-800 border border-amber-500/50 rounded-lg shadow-xl p-4 relative overflow-hidden">
        <div className="flex items-start gap-3 pr-8">
          <span className="text-2xl shrink-0" aria-hidden>
            🏏
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-400">Reminder</p>
            <p className="text-[11px] text-slate-500 mt-0.5">CST now: {centralClock}</p>
            <ul className="mt-3 max-h-52 overflow-y-auto space-y-0 text-sm text-slate-200 leading-snug">
              {visible.map((m, i) => (
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

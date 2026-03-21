'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  buildUpcomingMatchesSearchParams,
  selectMatchesForReminderWindow,
  formatReminderLine,
  REMINDER_WINDOW_HOURS,
} from '@/lib/upcoming-notifications';
import { formatCentralNow } from '@/lib/app-timezone';

type Item = {
  id: string;
  date: string;
  time: string;
  opponent: string;
  is_practice?: boolean;
  playing11_added?: boolean;
};

const STORAGE_KEY = 'pirates_notification_bar_closed';
const REFRESH_MS = 60_000;
const CLOCK_MS = 30_000;

export default function NotificationBar() {
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [closed, setClosed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [centralClock, setCentralClock] = useState('');

  const tickClock = useCallback(() => setCentralClock(formatCentralNow()), []);

  function handleClose() {
    setClosed(true);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {}
  }

  function handleReopen() {
    setClosed(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  const loadMatches = useCallback(() => {
    const qs = buildUpcomingMatchesSearchParams();
    fetch(`/api/upcoming-matches?${qs}`, { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setItems(selectMatchesForReminderWindow(data, new Date()));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    tickClock();
  }, [tickClock]);

  useEffect(() => {
    setMounted(true);
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true') setClosed(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (!mounted) return;
    loadMatches();
    const dataT = setInterval(loadMatches, REFRESH_MS);
    return () => clearInterval(dataT);
  }, [mounted, loadMatches]);

  useEffect(() => {
    if (!mounted) return;
    const handler = () => loadMatches();
    window.addEventListener('playing11-updated', handler);
    return () => window.removeEventListener('playing11-updated', handler);
  }, [mounted, loadMatches]);

  useEffect(() => {
    tickClock();
    const clockT = setInterval(tickClock, CLOCK_MS);
    return () => clearInterval(clockT);
  }, [tickClock]);

  if (!mounted || !loaded) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 bg-slate-800/80 text-slate-400 text-sm">
        <span aria-hidden>🔔</span>
        Loading notifications…
      </div>
    );
  }

  if (closed) {
    return (
      <button
        type="button"
        onClick={handleReopen}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--pirate-yellow)]/50 text-[var(--pirate-yellow)] hover:bg-[var(--pirate-navy)]"
        aria-label="Reopen notifications"
      >
        <span className="text-lg">🔔</span>
        <span className="text-sm">
          Notifications{items.length > 0 ? ` (${items.length})` : ''}
        </span>
      </button>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex items-start gap-3 overflow-hidden rounded-lg border border-[var(--pirate-green)]/50 bg-[var(--pirate-navy)]/95 px-3 py-2 max-w-md">
        <span className="text-xl flex-shrink-0 mt-0.5" aria-hidden>
          🔔
        </span>
        <div className="flex-1 min-w-0 text-sm text-slate-400 space-y-1">
          <p>
            No upcoming matches.{' '}
            <Link href="/schedule" className="text-[var(--pirate-yellow)] hover:underline">
              Schedule
            </Link>
          </p>
          <p className="text-xs text-slate-500">CST now: {centralClock}</p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="flex-shrink-0 text-slate-400 hover:text-white p-1"
          aria-label="Close notifications"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 overflow-hidden rounded-lg border border-[var(--pirate-green)]/50 bg-[var(--pirate-navy)]/95 px-3 py-2 max-w-2xl">
      <span className="text-xl flex-shrink-0 mt-0.5" aria-hidden>
        🔔
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-[11px] text-slate-500">
          CST now: {centralClock} · next {REMINDER_WINDOW_HOURS}h
        </p>
        <div
          className="overflow-x-auto scroll-smooth flex flex-nowrap items-center gap-x-3 py-0.5"
          style={{ scrollbarWidth: 'thin' }}
        >
          {items.map((m, i) => (
            <span key={m.id} className="flex flex-shrink-0 items-center gap-x-3">
              {i > 0 && (
                <span className="text-slate-600 select-none" aria-hidden>
                  |
                </span>
              )}
              <Link
                href="/schedule"
                className="text-sm whitespace-nowrap text-[var(--pirate-cream)] hover:text-[var(--pirate-yellow)]"
              >
                {formatReminderLine(m)}
              </Link>
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={handleClose}
        className="flex-shrink-0 text-slate-400 hover:text-white p-1"
        aria-label="Close notifications"
      >
        ×
      </button>
    </div>
  );
}

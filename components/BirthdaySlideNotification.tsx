'use client';

import { useEffect, useState, useCallback } from 'react';
import { toAppZonedYmdFromDate } from '@/lib/app-timezone';
import { pickBirthdaySlideMessage } from '@/lib/birthday-messages';

/** One slide per calendar day per browser for the whole team (localStorage). */
const STORAGE_PREFIX = 'pirates_birthday_team_slide_ack_';

type Celebrant = { id: string; name: string };

export default function BirthdaySlideNotification() {
  const [celebrants, setCelebrants] = useState<Celebrant[]>([]);
  const [visible, setVisible] = useState(false);
  const [todayKey, setTodayKey] = useState('');

  const dismiss = useCallback(() => {
    if (!todayKey) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + todayKey, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  }, [todayKey]);

  useEffect(() => {
    setTodayKey(toAppZonedYmdFromDate());
  }, []);

  useEffect(() => {
    if (!todayKey) return;
    try {
      if (localStorage.getItem(STORAGE_PREFIX + todayKey) === '1') return;
    } catch {
      return;
    }

    fetch('/api/birthdays-today', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { celebrants: [] }))
      .then((data: { celebrants?: Celebrant[] }) => {
        const list = Array.isArray(data.celebrants) ? data.celebrants : [];
        if (list.length === 0) return;
        try {
          if (localStorage.getItem(STORAGE_PREFIX + todayKey) === '1') return;
        } catch {
          return;
        }
        setCelebrants(list);
        setVisible(true);
      })
      .catch(() => {});
  }, [todayKey]);

  if (!visible || celebrants.length === 0 || !todayKey) return null;

  return (
    <div
      className="fixed top-4 left-4 z-[55] w-full max-w-md px-3 sm:px-0 pirates-birthday-slide-in"
      role="status"
      aria-live="polite"
    >
      <div className="bg-gradient-to-r from-amber-900/95 to-slate-800 border border-amber-400/60 rounded-lg shadow-xl p-4 pr-10 relative overflow-hidden">
        <p className="text-amber-100 font-semibold text-sm leading-snug">
          🎂 Team birthday{celebrants.length > 1 ? 's' : ''} today
        </p>
        <ul className="mt-2.5 space-y-2.5 text-sm text-amber-50 leading-snug">
          {celebrants.map((c) => (
            <li key={c.id}>
              <span className="font-medium text-amber-100">{c.name}</span>
              <span className="text-amber-200/95"> — {pickBirthdaySlideMessage(c.id, todayKey)}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-2 right-2 text-amber-200/90 hover:text-white text-xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-amber-800/50"
          aria-label="Dismiss birthday message"
        >
          ×
        </button>
      </div>
    </div>
  );
}

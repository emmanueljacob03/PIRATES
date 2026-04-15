'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, addMonths, subMonths, startOfMonth, getDay, getDaysInMonth, parseISO } from 'date-fns';
import type { Match } from '@/types/database';
import ScheduleMatchWeather from './ScheduleMatchWeather';

function isPractice(m: Match) {
  return (m.opponent || '').toLowerCase().includes('practice');
}

function formatMatchDate(date: string) {
  const parsed = parseISO(date.slice(0, 10));
  return format(parsed, 'EEE, MMM d, yyyy');
}

/** Same trash control as Team Budget (BudgetContributions). */
function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

export default function ScheduleList({ matches, isAdmin }: { matches: Match[]; isAdmin?: boolean }) {
  const router = useRouter();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDeleteMatch(matchId: string, label: string) {
    if (!isAdmin) return;
    if (!window.confirm(`Delete this match from the schedule?\n${label}`)) return;
    setDeletingId(matchId);
    try {
      const res = await fetch(`/api/matches/${matchId}`, { method: 'DELETE', credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string })?.error || res.statusText);
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  const dateToMatchType = useMemo(() => {
    const map = new Map<string, 'practice' | 'match'>();
    (matches ?? []).forEach((m) => {
      const key = typeof m.date === 'string' ? m.date.slice(0, 10) : '';
      if (!key) return;
      const practice = isPractice(m);
      if (!map.has(key)) map.set(key, practice ? 'practice' : 'match');
      else if (map.get(key) === 'practice' && !practice) map.set(key, 'match');
    });
    return map;
  }, [matches]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setView('list')}
          className={`${view === 'list' ? 'btn-primary' : 'btn-secondary'} transition hover:opacity-90`}
        >
          List
        </button>
        <button
          type="button"
          onClick={() => setView('calendar')}
          className={`${view === 'calendar' ? 'btn-primary' : 'btn-secondary'} transition hover:opacity-90`}
        >
          Calendar
        </button>
      </div>

      {view === 'list' && (
        <ul className="space-y-3">
          {matches.length === 0 ? (
            <p className="text-slate-400">No matches scheduled.</p>
          ) : (
            matches.map((m) => {
              const practice = isPractice(m);
              return (
                <li
                  key={m.id}
                  className={`rounded-lg p-3 transition hover:opacity-95 relative ${
                    practice
                      ? 'bg-slate-700/50 border-2 border-white/60'
                      : 'bg-slate-700/50 border-2 border-[var(--pirate-yellow)]'
                  }`}
                >
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteMatch(
                          m.id,
                          `${practice ? 'Practice' : m.opponent} · ${formatMatchDate(m.date)}`,
                        )
                      }
                      disabled={deletingId === m.id}
                      className="absolute top-2 right-2 inline-flex items-center justify-center p-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/40 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Delete match"
                      aria-label={`Delete match ${formatMatchDate(m.date)}`}
                    >
                      <TrashIcon />
                    </button>
                  )}
                  <p className={`font-medium text-white ${isAdmin ? 'pr-10' : ''}`}>
                    {practice ? 'Practice · ' : ''}
                    {formatMatchDate(m.date)} at {m.time}
                  </p>
                  <p className="text-slate-300">vs {m.opponent} · {m.ground}</p>
                  <ScheduleMatchWeather match={m} />
                  {m.advisory && (
                    <p className="text-sm text-amber-400 mt-2">⚠ {m.advisory}</p>
                  )}
                  {isAdmin && !practice && (
                    <Link
                      href={`/schedule/${m.id}/scorecard`}
                      className="text-sm text-amber-400 hover:underline mt-2 inline-block"
                    >
                      Add / Edit scorecard →
                    </Link>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}

      {view === 'calendar' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setCalendarDate((d) => subMonths(d, 1))}
              className="btn-secondary py-1 px-2 text-sm"
            >
              ← Prev
            </button>
            <span className="text-white font-medium">
              {format(calendarDate, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={() => setCalendarDate((d) => addMonths(d, 1))}
              className="btn-secondary py-1 px-2 text-sm"
            >
              Next →
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-slate-400 font-medium">{d}</div>
            ))}
            {(() => {
              const start = startOfMonth(calendarDate);
              const day = getDay(start);
              const blanks = Array(day).fill(null);
              const daysInMonth = getDaysInMonth(calendarDate);
              const days = [...blanks, ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
              const year = calendarDate.getFullYear();
              const month = calendarDate.getMonth();
              return days.map((d, i) => {
                const dateStr = d === null ? '' : `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const matchType = dateStr ? dateToMatchType.get(dateStr) : null;
                const isPracticeDay = matchType === 'practice';
                const isMatchDay = matchType === 'match';
                const isAnyMatchDay = isPracticeDay || isMatchDay;
                const title = isPracticeDay ? 'Must Attend' : isMatchDay ? 'Lets Win' : undefined;
                return (
                  <div
                    key={i}
                    className={`p-2 rounded transition ${
                      d === null
                        ? 'invisible'
                        : isPracticeDay
                          ? 'ring-2 ring-white/80 ring-offset-1 ring-offset-[var(--pirate-dark)] bg-white/20 text-white font-medium'
                          : isMatchDay
                            ? 'ring-2 ring-[var(--pirate-yellow)] ring-offset-1 ring-offset-[var(--pirate-dark)] bg-amber-500/30 text-white font-medium'
                            : 'text-slate-500 hover:bg-slate-700/30'
                    }`}
                    title={title}
                  >
                    {d}
                    {isAnyMatchDay && d !== null && (
                      <span className={`block text-xs mt-0.5 font-medium ${isPracticeDay ? 'text-white' : 'text-amber-200'}`}>
                        {isPracticeDay ? 'Practice Match' : 'Pirates Match'}
                      </span>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

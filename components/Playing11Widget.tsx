'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildUpcomingMatchesSearchParams,
  selectMatchesForReminderWindow,
} from '@/lib/upcoming-notifications';
import { formatMatchDate } from '@/lib/match-date';
import { isWithinPlaying11VisibilityWindow, PLAYING11_VISIBILITY_HOURS_AFTER_START } from '@/lib/app-timezone';
import { REQUIRED_PLAYING11_COUNT } from '@/lib/playing11-config';

type UpcomingItem = {
  id: string;
  date: string;
  time: string;
  opponent: string;
  is_practice?: boolean;
  playing11_added?: boolean;
};

type LineupPlayer = {
  id: string;
  name: string;
  jersey_number: number;
  role: 'playing11' | 'extra' | null;
};

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

export default function Playing11Widget({
  isAdmin,
  variant = 'header',
}: {
  isAdmin: boolean;
  variant?: 'header' | 'metrics';
}) {
  const [open, setOpen] = useState(false);
  const [match, setMatch] = useState<UpcomingItem | null>(null);
  const [players, setPlayers] = useState<LineupPlayer[]>([]);
  const [lineupVisible, setLineupVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverHadLineup, setServerHadLineup] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildUpcomingMatchesSearchParams();
      const r = await fetch(`/api/upcoming-matches?${qs}`, {
        credentials: 'same-origin',
      });
      const data = await r.json();
      if (!Array.isArray(data)) {
        setMatch(null);
        setPlayers([]);
        setLoading(false);
        return;
      }

      const upcoming72 = selectMatchesForReminderWindow(data, new Date());
      const nextMatch = upcoming72.find((m: UpcomingItem) => !m.is_practice) ?? null;
      setMatch(nextMatch);

      if (!nextMatch) {
        setPlayers([]);
        setLoading(false);
        return;
      }

      const lineupRes = await fetch(
        `/api/playing11?matchId=${encodeURIComponent(nextMatch.id)}`,
        { credentials: 'same-origin' },
      );
      const lineupJson = await lineupRes.json();
      const lineupPlayers = Array.isArray(lineupJson?.players) ? lineupJson.players : [];
      setPlayers(lineupPlayers);
      const vis =
        typeof lineupJson?.lineup_visible === 'boolean'
          ? lineupJson.lineup_visible
          : isWithinPlaying11VisibilityWindow(nextMatch.date, nextMatch.time, new Date());
      setLineupVisible(vis);
    } catch {
      setMatch(null);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('playing11-updated', handler);
    return () => window.removeEventListener('playing11-updated', handler);
  }, [refresh]);

  /** Re-check 4h-after-start boundary without full navigation. */
  useEffect(() => {
    const t = setInterval(() => refresh(), 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const playingIds = useMemo(
    () => new Set(players.filter((p) => p.role === 'playing11').map((p) => p.id)),
    [players],
  );
  const extraIds = useMemo(
    () => new Set(players.filter((p) => p.role === 'extra').map((p) => p.id)),
    [players],
  );

  // Defensive: show each registered player only once by id.
  // If the API ever returns duplicates, this prevents doubled names in the metrics card.
  const uniquePlayers = useMemo(() => {
    const m = new Map<string, (typeof players)[number]>();
    players.forEach((p) => m.set(p.id, p));
    return Array.from(m.values());
  }, [players]);

  const [editPlaying, setEditPlaying] = useState<string[]>([]);
  const [editExtras, setEditExtras] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setEditPlaying(Array.from(playingIds));
    setEditExtras(Array.from(extraIds));
  }, [open, playingIds, extraIds]);

  useEffect(() => {
    if (!open) {
      setServerHadLineup(false);
      return;
    }
    if (loading) return;
    setServerHadLineup(playingIds.size === REQUIRED_PLAYING11_COUNT);
  }, [open, loading, playingIds.size, match?.id]);

  const canSave = useMemo(
    () => editPlaying.length === REQUIRED_PLAYING11_COUNT,
    [editPlaying],
  );

  const toggleGreen = (playerId: string) => {
    setEditPlaying((prev) => {
      const next = prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId];
      return uniq(next);
    });
    setEditExtras((prev) => prev.filter((id) => id !== playerId));
  };

  const toggleYellow = (playerId: string) => {
    setEditExtras((prev) => {
      const next = prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId];
      return uniq(next);
    });
    setEditPlaying((prev) => prev.filter((id) => id !== playerId));
  };

  const save = async () => {
    if (!match) return;
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await fetch('/api/playing11', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          matchId: match.id,
          playingIds: editPlaying,
          extraIds: editExtras,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string })?.error ?? res.statusText);

      window.dispatchEvent(
        new CustomEvent('playing11-updated', { detail: { matchId: match.id } }),
      );
      setOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const matchLine = match
    ? `${formatMatchDate(match.date, 'MMM d, yyyy')} · ${match.time} vs ${match.opponent}`
    : '';

  const isMetrics = variant === 'metrics';

  return (
    <div className="relative">
      {isMetrics ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="fingers crossed"
          className="group card card-hover-lift cursor-pointer w-full text-left disabled:opacity-60 disabled:cursor-not-allowed bg-[rgba(201,162,39,0.12)] border-[rgba(201,162,39,0.55)] hover:shadow-[0_0_18px_rgba(250,204,21,0.35)]"
          aria-label="Open Playing 11"
          disabled={loading}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[22px] font-bold text-[var(--pirate-yellow)] mt-0.5 leading-tight">
                PLAYING 11
              </div>
            </div>
            <span aria-hidden className="text-[var(--pirate-yellow)] text-xl pt-1">
              🤞
            </span>
          </div>

        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="fingers crossed"
          className="relative flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700/70 bg-slate-800/60 text-slate-200 hover:bg-slate-800 transition"
          aria-label="Open Playing 11"
          disabled={loading}
        >
          <span aria-hidden>🤞</span>
          <span className="text-sm text-slate-200 font-medium">Playing 11</span>
          <span className="absolute -top-10 left-0 opacity-0 group-hover:opacity-100 pointer-events-none" />
        </button>
      )}

      {/* Tooltip */}
      <div className="pointer-events-none absolute -top-9 left-12 opacity-0 group-hover:opacity-100 transition" />

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-3 py-10"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-800">
              <div>
                <div className="text-base font-semibold text-white underline decoration-[var(--pirate-yellow)] decoration-2 underline-offset-4">
                  Playing 11
                </div>
                {match && <div className="text-xs text-slate-400 mt-1">{matchLine}</div>}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-slate-800"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-auto">
              {!match && (
                <div className="text-slate-300 text-sm">
                  No upcoming matches right now.
                </div>
              )}

              {match && !lineupVisible && (
                <p className="text-sm text-slate-400">
                  Playing 11 is hidden — it clears {PLAYING11_VISIBILITY_HOURS_AFTER_START} hours after
                  match start (Central Time). Data will refresh automatically.
                </p>
              )}

              {match && lineupVisible && !isAdmin && (
                <div className="space-y-4">
                  {(() => {
                    const sorted = uniquePlayers
                      .slice()
                      .sort((a, b) => a.jersey_number - b.jersey_number);
                    const eleven = sorted.filter((p) => p.role === 'playing11');
                    const extras = sorted.filter((p) => p.role === 'extra');
                    return (
                      <>
                        <div>
                          <div className="text-sm font-semibold text-green-400 underline underline-offset-2 decoration-green-500/60">
                            Playing 11
                          </div>
                          {eleven.length === 0 ? (
                            <p className="text-xs text-slate-500 mt-2">No lineup published yet.</p>
                          ) : (
                            <ul className="mt-2 space-y-1 text-sm text-green-300">
                              {eleven.map((p) => (
                                <li key={p.id} className="flex items-center gap-2">
                                  <span aria-hidden>✓</span>
                                  <span>{p.name}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-amber-300 underline underline-offset-2 decoration-amber-400/60 mt-4">
                            Extras
                          </div>
                          {extras.length === 0 ? (
                            <p className="text-xs text-slate-500 mt-2">None listed.</p>
                          ) : (
                            <ul className="mt-2 space-y-1 text-sm text-amber-200">
                              {extras.map((p) => (
                                <li key={p.id} className="flex items-center gap-2">
                                  <span aria-hidden>✓</span>
                                  <span>{p.name}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {match && lineupVisible && isAdmin && (
                <>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="rounded-lg border border-slate-800 bg-slate-800/20 p-3">
                          <div className="text-sm font-semibold text-green-400 underline underline-offset-2 decoration-green-500/60">
                            Playing 11 ({editPlaying.length}/{REQUIRED_PLAYING11_COUNT})
                          </div>
                          <ul className="text-sm text-slate-200 mt-2 space-y-1 max-h-56 overflow-auto pr-1">
                            {uniquePlayers
                              .slice()
                              .sort((a, b) => a.jersey_number - b.jersey_number)
                              .map((p) => {
                                const isPlaying = editPlaying.includes(p.id);
                                return (
                                  <li
                                    key={p.id}
                                    className="flex items-center justify-between gap-3"
                                  >
                                    <span className={`truncate ${isPlaying ? 'text-green-300' : 'text-slate-200'}`}>
                                      {p.name}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => toggleGreen(p.id)}
                                      className={`w-7 h-7 rounded-md border text-sm flex items-center justify-center shrink-0 ${
                                        isPlaying
                                          ? 'bg-green-500 border-green-500 text-black'
                                          : 'border-green-500/60 text-green-400 hover:bg-green-500/10'
                                      }`}
                                      aria-label={`Set playing11: ${p.name}`}
                                      title="Set as playing 11"
                                    >
                                      ✓
                                    </button>
                                  </li>
                                );
                              })}
                          </ul>
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-slate-800/20 p-3">
                          <div className="text-sm font-semibold text-amber-300 underline underline-offset-2 decoration-amber-400/60">
                            Extras ({editExtras.length})
                          </div>
                          <ul className="text-sm text-slate-200 mt-2 space-y-1 max-h-56 overflow-auto pr-1">
                            {uniquePlayers
                              .slice()
                              .sort((a, b) => a.jersey_number - b.jersey_number)
                              .map((p) => {
                                const isExtra = editExtras.includes(p.id);
                                return (
                                  <li
                                    key={p.id}
                                    className="flex items-center justify-between gap-3"
                                  >
                                    <span className={`truncate ${isExtra ? 'text-amber-200' : 'text-slate-200'}`}>
                                      {p.name}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => toggleYellow(p.id)}
                                      className={`w-7 h-7 rounded-md border text-sm flex items-center justify-center shrink-0 ${
                                        isExtra
                                          ? 'bg-amber-300 border-amber-300 text-black'
                                          : 'border-amber-400/60 text-amber-300 hover:bg-amber-300/10'
                                      }`}
                                      aria-label={`Set extra: ${p.name}`}
                                      title="Set as extra"
                                    >
                                      ✓
                                    </button>
                                  </li>
                                );
                              })}
                          </ul>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setOpen(false)}
                          className="btn-secondary"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={save}
                          disabled={!canSave || saving}
                          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label={serverHadLineup ? 'Save Playing 11 changes' : 'Finalize Playing 11'}
                          title={
                            !canSave
                              ? `Select exactly ${REQUIRED_PLAYING11_COUNT} players`
                              : serverHadLineup
                                ? 'Save changes — notifies team again'
                                : 'Save playing 11'
                          }
                        >
                          {saving ? 'Saving…' : serverHadLineup ? 'Save changes' : 'Finalize & Save'}
                        </button>
                      </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


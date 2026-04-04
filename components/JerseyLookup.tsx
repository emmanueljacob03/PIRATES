'use client';

import { useState, useMemo } from 'react';
import type { JerseyRow } from '@/lib/jersey-utils';
import { stripJerseyRequestNotePrefix } from '@/lib/jersey-utils';

const NEW_JERSEY_AMOUNT = 50;

export default function JerseyLookup({
  jerseys,
  isAdmin,
  onPaidToggle,
  onDeleteJersey,
}: {
  jerseys: JerseyRow[];
  isAdmin?: boolean;
  onPaidToggle?: (id: string, paid: boolean) => void;
  onDeleteJersey?: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [notesOpenFor, setNotesOpenFor] = useState<string | null>(null);

  const results = useMemo(() => {
    if (!query.trim()) return jerseys;
    const q = query.trim().toLowerCase();
    return jerseys.filter(
      (j) =>
        (j.player_name ?? '').toLowerCase().includes(q) ||
        (j.submitter_name ?? '').toLowerCase().includes(q) ||
        String(j.jersey_number).toLowerCase() === q,
    );
  }, [jerseys, query]);

  return (
    <div className="space-y-4">
      <input
        type="text"
        className="input-field"
        placeholder="Search Player / Jersey Number"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="space-y-2">
        {results.length === 0 ? (
          <p className="text-slate-400">{query.trim() ? 'No match found.' : 'No jerseys yet.'}</p>
        ) : (
          results.map((j) => {
            const submitter = (j.submitter_name ?? '').trim();
            const player = (j.player_name ?? '').trim();
            const showSubmitter =
              !!submitter && submitter.toLowerCase() !== player.toLowerCase();
            const noteDisplay = stripJerseyRequestNotePrefix(j.notes ?? null);
            const showNotesButton = noteDisplay.length > 0;
            return (
              <div key={j.id} className="bg-slate-700/50 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-white break-words">
                      {player}
                      {showSubmitter && (
                        <>
                          <span className="text-slate-500 font-normal"> — </span>
                          <span className="text-slate-500 font-normal">{submitter}</span>
                        </>
                      )}
                    </p>
                    <p className="text-sm text-slate-300">
                      Jersey #{j.jersey_number} · Size {j.size}
                    </p>
                    <p className="text-sm">{j.paid ? 'Paid ✔' : `Unpaid $${NEW_JERSEY_AMOUNT}`}</p>
                    {showNotesButton && (
                      <div className="mt-2">
                        <button
                          type="button"
                          className="text-slate-400 hover:text-slate-200 text-xl leading-none tracking-widest px-1 rounded"
                          aria-expanded={notesOpenFor === j.id}
                          aria-label={notesOpenFor === j.id ? 'Hide notes' : 'Show notes'}
                          onClick={() =>
                            setNotesOpenFor((id) => (id === j.id ? null : j.id))
                          }
                        >
                          ···
                        </button>
                        {notesOpenFor === j.id && (
                          <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap">{noteDisplay}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {isAdmin && onPaidToggle && (
                    <label className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-300 shrink-0">
                      <input
                        type="checkbox"
                        checked={!!j.paid}
                        onChange={() => onPaidToggle(j.id, !j.paid)}
                        className="rounded border-slate-500"
                      />
                      Paid
                    </label>
                  )}
                </div>

                {isAdmin && onDeleteJersey && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm('Delete this jersey entry?')) return;
                        onDeleteJersey(j.id);
                      }}
                      className="text-xs text-slate-400 hover:text-red-400"
                      aria-label="Delete jersey"
                      title="Delete jersey"
                    >
                      🗑 Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

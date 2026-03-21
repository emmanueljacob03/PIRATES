'use client';

import { useState, useMemo } from 'react';
import type { Jersey } from '@/types/database';

const NEW_JERSEY_AMOUNT = 50;

export default function JerseyLookup({
  jerseys,
  isAdmin,
  onPaidToggle,
  onDeleteJersey,
}: {
  jerseys: Jersey[];
  isAdmin?: boolean;
  onPaidToggle?: (id: string, paid: boolean) => void;
  onDeleteJersey?: (id: string) => void;
}) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return jerseys;
    const q = query.trim().toLowerCase();
    return jerseys.filter(
      (j) =>
        (j.player_name ?? '').toLowerCase().includes(q) ||
        String(j.jersey_number) === q
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
          results.map((j) => (
            <div key={j.id} className="bg-slate-700/50 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-white">{j.player_name}</p>
                  <p className="text-sm text-slate-300">Jersey #{j.jersey_number} · Size {j.size}</p>
                  <p className="text-sm">{j.paid ? 'Paid ✔' : `Unpaid $${NEW_JERSEY_AMOUNT}`}</p>
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
          ))
        )}
      </div>
    </div>
  );
}

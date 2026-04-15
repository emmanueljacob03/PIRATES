'use client';

import { useState, useMemo } from 'react';
import type { JerseyRow } from '@/lib/jersey-utils';
import { stripJerseyRequestNotePrefix, NEW_JERSEY_AMOUNT_USD } from '@/lib/jersey-utils';

function PenIcon({ className }: { className?: string }) {
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
      className={className}
      aria-hidden
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
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

export default function JerseyLookup({
  jerseys,
  isAdmin,
  currentUserId = null,
  onPaidToggle,
  onDeleteJersey,
  onJerseyUpdated,
}: {
  jerseys: JerseyRow[];
  isAdmin?: boolean;
  /** Logged-in user: may edit own jersey row (name, size, notes) via pen when it matches submitted_by_id. */
  currentUserId?: string | null;
  onPaidToggle?: (id: string, paid: boolean) => void;
  onDeleteJersey?: (id: string) => void;
  onJerseyUpdated?: (row: JerseyRow) => void;
}) {
  const [query, setQuery] = useState('');
  const [notesOpenFor, setNotesOpenFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPlayer, setEditPlayer] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

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

  function canEditRow(j: JerseyRow): boolean {
    if (isAdmin) return true;
    const uid = currentUserId?.trim();
    if (!uid) return false;
    const ownerId = j.submitted_by_id ?? j.inferred_submitted_by_id ?? null;
    return ownerId === uid;
  }

  async function saveEdit(id: string) {
    const pn = editPlayer.trim();
    const sz = editSize.trim();
    if (!pn || !sz) return;
    setSaving(true);
    try {
      const res = await fetch('/api/jerseys', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          player_name: pn,
          size: sz,
          notes: editNotes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert((data as { error?: string })?.error || 'Save failed');
        return;
      }
      if (data && onJerseyUpdated) onJerseyUpdated(data as JerseyRow);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(j: JerseyRow) {
    setEditingId(j.id);
    setEditPlayer((j.player_name ?? '').trim());
    setEditSize((j.size ?? '').trim());
    setEditNotes(j.notes ?? '');
  }

  return (
    <div className="space-y-4">
      {currentUserId && !isAdmin ? (
        <p className="text-slate-500 text-xs">
          Use the pencil on <span className="text-slate-400">your</span> jersey row to edit name, size, or notes.
        </p>
      ) : null}
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
            const isEditing = editingId === j.id;

            return (
              <div
                key={j.id}
                className="rounded-lg border border-slate-600/70 bg-slate-900/50 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          className="input-field text-sm"
                          value={editPlayer}
                          onChange={(e) => setEditPlayer(e.target.value)}
                          placeholder="Player name"
                        />
                        <input
                          className="input-field text-sm w-24"
                          value={editSize}
                          onChange={(e) => setEditSize(e.target.value)}
                          placeholder="Size"
                        />
                        <textarea
                          className="input-field text-sm min-h-[72px]"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Notes / comment (optional)"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn-primary text-xs py-1 px-2"
                            disabled={saving}
                            onClick={() => void saveEdit(j.id)}
                          >
                            {saving ? '…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary text-xs py-1 px-2"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
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
                        <p className="text-sm">{j.paid ? 'Paid ✔' : `Unpaid $${NEW_JERSEY_AMOUNT_USD}`}</p>
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
                      </>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {canEditRow(j) && !isEditing && (
                      <button
                        type="button"
                        onClick={() => startEdit(j)}
                        className="inline-flex items-center justify-center p-1.5 rounded-md text-[var(--pirate-yellow)] hover:bg-slate-800/80 border border-slate-600/80"
                        title="Edit name, size, notes"
                        aria-label="Edit jersey"
                      >
                        <PenIcon />
                      </button>
                    )}
                    {isAdmin && onDeleteJersey && !isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm('Delete this jersey entry?')) return;
                          onDeleteJersey(j.id);
                        }}
                        className="inline-flex items-center justify-center p-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/40"
                        title="Delete jersey"
                        aria-label="Delete jersey"
                      >
                        <TrashIcon />
                      </button>
                    )}
                    {isAdmin && onPaidToggle && !isEditing && (
                      <label className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-300">
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
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

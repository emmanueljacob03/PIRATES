'use client';

import { useMemo, useState, useEffect } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import {
  isUmpiringDutyCompleted,
  dutyScheduledStartMs,
  playerHasActiveUmpiringDuty,
} from '@/lib/umpiring-duties';

type Duty = {
  id: string;
  who: string;
  duty_date: string;
  duty_time?: string | null;
  notes: string | null;
  player_id?: string | null;
};

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

function formatDutyDate(ymd: string): string {
  try {
    const d = parseISO(ymd.slice(0, 10));
    return isValid(d) ? format(d, 'MMM d, yyyy') : ymd;
  } catch {
    return ymd;
  }
}

function timeForInput(t?: string | null): string {
  const raw = (t || '12:00').trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '12:00';
  return `${String(Math.min(23, Math.max(0, parseInt(m[1], 10)))).padStart(2, '0')}:${String(Math.min(59, Math.max(0, parseInt(m[2], 10)))).padStart(2, '0')}`;
}

export default function UmpiringDuties({
  canEdit = false,
  roster = [],
}: {
  canEdit?: boolean;
  roster?: { id: string; name: string }[];
}) {
  const [duties, setDuties] = useState<Duty[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWho, setEditWho] = useState('');
  const [editPlayerId, setEditPlayerId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('12:00');
  const [editNotes, setEditNotes] = useState('');

  const [newPlayerId, setNewPlayerId] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('12:00');
  const [newNotes, setNewNotes] = useState('');

  useEffect(() => {
    fetch('/api/umpiring', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setDuties(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!newDate) setNewDate(new Date().toISOString().slice(0, 10));
  }, [newDate]);

  const sorted = useMemo(
    () =>
      [...duties].sort(
        (a, b) => dutyScheduledStartMs(a.duty_date, a.duty_time) - dutyScheduledStartMs(b.duty_date, b.duty_time),
      ),
    [duties],
  );

  const rosterById = useMemo(() => {
    const m = new Map<string, string>();
    roster.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [roster]);

  function startEdit(d: Duty) {
    setEditingId(d.id);
    setEditWho(d.who);
    setEditPlayerId(d.player_id ?? '');
    setEditDate(d.duty_date.slice(0, 10));
    setEditTime(timeForInput(d.duty_time));
    setEditNotes(d.notes ?? '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditWho('');
    setEditPlayerId('');
    setEditDate('');
    setEditTime('12:00');
    setEditNotes('');
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newPlayerId.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/umpiring', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: newPlayerId.trim(),
          duty_date: newDate || new Date().toISOString().slice(0, 10),
          duty_time: newTime || '12:00',
          notes: newNotes.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert((data as { error?: string })?.error || 'Could not add duty.');
        return;
      }
      if (data?.id) {
        setDuties((prev) => [...prev, data as Duty]);
        setNewPlayerId('');
        setNewNotes('');
        setNewTime('12:00');
        setNewDate(new Date().toISOString().slice(0, 10));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/umpiring/${editingId}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: editPlayerId || null,
          who: editWho.trim(),
          duty_date: editDate,
          duty_time: editTime || '12:00',
          notes: editNotes.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert((data as { error?: string })?.error || 'Could not save.');
        return;
      }
      if (data?.id) {
        setDuties((prev) => prev.map((x) => (x.id === editingId ? (data as Duty) : x)));
        cancelEdit();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this umpiring duty?')) return;
    const res = await fetch(`/api/umpiring/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert((data as { error?: string })?.error || 'Delete failed');
      return;
    }
    setDuties((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) cancelEdit();
  }

  function playersAvailableForAdd(): { id: string; name: string }[] {
    return roster.filter((p) => !playerHasActiveUmpiringDuty(p.id, p.name, duties, null));
  }

  function playersAvailableForEdit(): { id: string; name: string }[] {
    const cur = editingId ? duties.find((x) => x.id === editingId) : null;
    return roster.filter((p) => {
      const isCurrent =
        (cur?.player_id && cur.player_id === p.id) ||
        (!!cur &&
          !cur.player_id &&
          (cur.who ?? '').trim().toLowerCase() === (p.name ?? '').trim().toLowerCase());
      if (isCurrent) return true;
      return !playerHasActiveUmpiringDuty(p.id, p.name, duties, editingId);
    });
  }

  function onEditPlayerChange(pid: string) {
    setEditPlayerId(pid);
    if (pid && rosterById.has(pid)) {
      setEditWho(rosterById.get(pid)!);
    }
  }

  if (loading) return <div className="card"><p className="text-slate-400">Loading…</p></div>;

  function rowContent(d: Duty, adminRow: boolean) {
    const done = isUmpiringDutyCompleted(d.duty_date, d.duty_time);
    const timeLabel = timeForInput(d.duty_time);

    if (editingId === d.id && adminRow) {
      const pick = playersAvailableForEdit();
      return (
        <div className="rounded-lg border border-slate-600 bg-slate-800/80 p-3 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <label className="text-xs text-slate-400 w-full sm:w-auto">Player</label>
            <select
              className="input-field text-sm flex-1 min-w-[140px]"
              value={editPlayerId}
              onChange={(e) => onEditPlayerChange(e.target.value)}
            >
              <option value="">Custom name (below)</option>
              {pick.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <input
            className="input-field text-sm"
            placeholder="Name (editable)"
            value={editWho}
            onChange={(e) => setEditWho(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <input type="date" className="input-field text-sm" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            <input type="time" className="input-field text-sm" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
          </div>
          <input
            className="input-field text-sm"
            placeholder="Note by admin"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" className="btn-primary text-sm" disabled={saving} onClick={() => void handleSaveEdit()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`relative rounded-lg border border-slate-600/80 bg-slate-800/40 p-3 ${adminRow ? 'pr-20' : ''}`}
      >
        {adminRow && (
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              type="button"
              className="inline-flex items-center justify-center p-1 rounded text-slate-500 hover:text-amber-400 hover:bg-amber-950/30"
              title="Edit"
              aria-label="Edit duty"
              onClick={() => startEdit(d)}
            >
              <PenIcon />
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/40"
              title="Delete"
              aria-label="Delete duty"
              onClick={() => void handleDelete(d.id)}
            >
              <TrashIcon />
            </button>
          </div>
        )}
        <p className="font-medium text-white pr-2">
          {d.who}
          {done && (
            <span className="ml-2 inline-block rounded px-2 py-0.5 text-xs font-medium bg-emerald-900/60 text-emerald-300">
              Completed
            </span>
          )}
        </p>
        <p className="text-sm text-slate-400 mt-1">
          {formatDutyDate(d.duty_date)} at {timeLabel}
          {d.notes ? <span className="text-slate-500"> — {d.notes}</span> : null}
        </p>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="card card-hover-lift">
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--pirate-yellow)' }}>
          Umpiring Duties
        </h3>
        <p className="text-slate-400 text-sm mb-4">View only. Admin will add umpiring duties here.</p>
        {sorted.length === 0 ? (
          <p className="text-slate-500 text-sm">No duties set yet.</p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((d) => (
              <li key={d.id}>{rowContent(d, false)}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const addOptions = playersAvailableForAdd();

  return (
    <div className="card card-hover-lift">
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--pirate-yellow)' }}>
        Umpiring Duties
      </h3>
      {sorted.length === 0 && <p className="text-slate-500 text-sm mb-4">No duties set yet.</p>}
      <ul className="space-y-2 mb-4">
        {sorted.map((d) => (
          <li key={d.id}>{rowContent(d, true)}</li>
        ))}
      </ul>

      <form onSubmit={(e) => void handleAdd(e)} className="space-y-3 border-t border-slate-600/60 pt-4">
        <p className="text-slate-400 text-sm">Add duty</p>
        <select
          className="input-field"
          value={newPlayerId}
          onChange={(e) => setNewPlayerId(e.target.value)}
          required
        >
          <option value="">Select player</option>
          {addOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {roster.length === 0 && (
          <p className="text-amber-400/90 text-xs">Enter the team code on the site so the roster loads for this picker.</p>
        )}
        {addOptions.length === 0 && roster.length > 0 && (
          <p className="text-slate-500 text-xs">All roster players have an active duty, or duties are still within 4h after scheduled time.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <input type="date" className="input-field" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <input type="time" className="input-field" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
        </div>
        <input
          className="input-field"
          placeholder="Note by admin (optional)"
          value={newNotes}
          onChange={(e) => setNewNotes(e.target.value)}
        />
        <button type="submit" className="btn-primary text-sm" disabled={saving || !newPlayerId}>
          {saving ? 'Adding…' : 'Add'}
        </button>
      </form>
    </div>
  );
}

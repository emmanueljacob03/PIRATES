'use client';

import { useState, useEffect } from 'react';

type Duty = { id: string; who: string; duty_date: string; notes: string };

export default function UmpiringDuties({ isAdmin, canEdit = isAdmin }: { isAdmin: boolean; canEdit?: boolean }) {
  const [duties, setDuties] = useState<Duty[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [who, setWho] = useState('');
  const [dutyDate, setDutyDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetch('/api/umpiring')
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setDuties(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!who.trim()) return;
    const res = await fetch('/api/umpiring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ who: who.trim(), duty_date: dutyDate || new Date().toISOString().slice(0, 10), notes: notes.trim() }),
    });
    if (res.ok) {
      const d = await res.json();
      setDuties((prev) => [...prev, d]);
      setWho('');
      setDutyDate('');
      setNotes('');
      setEditing(false);
    }
  }

  if (loading) return <div className="card"><p className="text-slate-400">Loading…</p></div>;

  if (!canEdit) {
    return (
      <div className="card card-hover-lift">
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--pirate-yellow)' }}>Umpiring Duties</h3>
        <p className="text-slate-400 text-sm mb-4">View only. Admin will add umpiring duties here.</p>
        {duties.length === 0 ? (
          <p className="text-slate-500 text-sm">No duties set yet.</p>
        ) : (
          <ul className="space-y-2">
            {duties.map((d) => (
              <li key={d.id} className="text-sm text-slate-300">
                <span className="font-medium text-white">{d.who}</span>
                {d.duty_date && <span className="text-slate-400"> — {d.duty_date}</span>}
                {d.notes && <span className="text-slate-500"> ({d.notes})</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="card card-hover-lift">
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--pirate-yellow)' }}>Umpiring Duties</h3>
      <p className="text-slate-400 text-sm mb-4">Admin view: who is to do when. Edit and add below.</p>
      {duties.length === 0 && !editing && (
        <p className="text-slate-500 text-sm mb-4">No duties set yet.</p>
      )}
      <ul className="space-y-2 mb-4">
        {duties.map((d) => (
          <li key={d.id} className="text-sm text-slate-300">
            <span className="font-medium text-white">{d.who}</span>
            {d.duty_date && <span className="text-slate-400"> — {d.duty_date}</span>}
            {d.notes && <span className="text-slate-500"> ({d.notes})</span>}
          </li>
        ))}
      </ul>
      {!editing ? (
        <button type="button" onClick={() => setEditing(true)} className="btn-secondary text-sm">
          Add / Edit duties
        </button>
      ) : (
        <form onSubmit={handleAdd} className="space-y-3">
          <input
            className="input-field"
            placeholder="Who"
            value={who}
            onChange={(e) => setWho(e.target.value)}
          />
          <input
            type="date"
            className="input-field"
            value={dutyDate}
            onChange={(e) => setDutyDate(e.target.value)}
          />
          <input
            className="input-field"
            placeholder="Notes (e.g. which day)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary text-sm">Add</button>
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

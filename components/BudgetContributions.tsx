'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Contribution } from '@/types/database';
import { format } from 'date-fns';

type Row = Contribution & { notes?: string | null; submitted_by_id?: string | null };

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function BudgetContributions({
  initial,
  isAdmin,
  viewerMode,
  rosterPlayerNames = [],
}: {
  initial: Row[];
  isAdmin?: boolean;
  /** Logged-in member: match fee form without paid checkbox; uses account name. */
  viewerMode?: boolean;
  /** Roster names for admin “player name” chevron picker (optional). */
  rosterPlayerNames?: string[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  /** Admin: type any name, or open roster list via the chevron inside the field. */
  const [adminPlayerName, setAdminPlayerName] = useState('');
  const [adminRosterOpen, setAdminRosterOpen] = useState(false);
  const adminRosterWrapRef = useRef<HTMLDivElement>(null);
  const [amount, setAmount] = useState('');
  const [paid, setPaid] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [viewerReason, setViewerReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMore, setViewMore] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const ap = !!a.paid;
      const bp = !!b.paid;
      if (ap !== bp) return ap ? -1 : 1;
      const at = new Date(a.date).getTime();
      const bt = new Date(b.date).getTime();
      return bt - at;
    });
    return copy;
  }, [rows]);

  const displayRows = viewMore ? sortedRows : sortedRows.slice(0, 5);
  const hasMore = sortedRows.length > 5;

  useEffect(() => {
    if (!adminRosterOpen) return;
    function onDocClick(e: MouseEvent) {
      if (adminRosterWrapRef.current && !adminRosterWrapRef.current.contains(e.target as Node)) {
        setAdminRosterOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [adminRosterOpen]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!amount) return;
    const amt = parseFloat(amount);
    if (isNaN(amt)) return;

    if (viewerMode) {
      setLoading(true);
      try {
        const res = await fetch('/api/contributions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amt,
            notes: viewerReason.trim() || undefined,
            date: new Date().toISOString().slice(0, 10),
          }),
        });
        const data = await res.json().catch(() => null);
        setLoading(false);
        if (!res.ok) {
          alert(data?.error || 'Could not add entry. Sign in and enter the team code.');
          return;
        }
        if (data?.id) {
          setRows((prev) => [data as Row, ...prev]);
            setAmount('');
            setViewerReason('');
            router.refresh();
        }
      } catch {
        setLoading(false);
      }
      return;
    }

    const name = adminPlayerName.trim();
    if (!name) return;
    setLoading(true);
    const res = await fetch('/api/contributions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_name: name,
        amount: amt,
        paid,
        date: new Date().toISOString().slice(0, 10),
        notes: adminNotes.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (data?.id) {
      setRows((prev) => [data as Row, ...prev]);
      setAdminPlayerName('');
      setAmount('');
      setPaid(false);
      setAdminNotes('');
      router.refresh();
    }
  }

  async function handleSaveEdit(id: string) {
    const amt = parseFloat(editAmount);
    if (isNaN(amt)) return;
    const res = await fetch('/api/contributions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, amount: amt }),
    });
    const data = await res.json().catch(() => null);
    if (data?.id) {
      setRows((prev) => prev.map((r) => (r.id === id ? data : r)));
      setEditingId(null);
      setEditAmount('');
    }
  }

  async function handlePaidToggle(id: string, paidVal: boolean) {
    const res = await fetch('/api/contributions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, paid: paidVal }),
    });
    const data = await res.json().catch(() => null);
    if (data?.id) setRows((prev) => prev.map((r) => (r.id === id ? data : r)));
  }

  async function handleDeleteContribution(id: string) {
    const ok = window.confirm('Are you sure you want to delete this record? This cannot be undone.');
    if (!ok) return;
    const res = await fetch('/api/contributions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert((data as { error?: string } | null)?.error ?? 'Delete failed');
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditAmount('');
    }
    router.refresh();
  }

  const showViewerTable = viewerMode && !isAdmin;

  return (
    <div className="space-y-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-600">
            <th className="pb-2">
              {showViewerTable ? (
                'Player name'
              ) : (
                'Player'
              )}
            </th>
            <th className="pb-2">Match fee</th>
            {showViewerTable ? (
              <th className="pb-2">Note</th>
            ) : (
              <>
                <th className="pb-2">Paid</th>
                {isAdmin ? <th className="pb-2">Reason / note</th> : rows.some((r) => r.notes) ? <th className="pb-2">Note</th> : null}
              </>
            )}
            <th className="pb-2">Date</th>
            {isAdmin && <th className="pb-2 w-20">Edit</th>}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((r) => (
            <tr key={r.id} className="border-b border-slate-700/50">
              <td className="py-2">{r.player_name}</td>
              <td className="py-2">
                {editingId === r.id ? (
                  <input
                    type="number"
                    step="0.01"
                    className="input-field w-24 py-1 text-sm"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <span>${Number(r.amount).toFixed(2)}</span>
                )}
              </td>
              {showViewerTable ? (
                <td className="py-2 text-slate-300 max-w-[200px]">
                  {r.notes ? <span className="text-sm">{r.notes}</span> : <span className="text-slate-500">—</span>}
                </td>
              ) : (
                <>
                  <td className="py-2">
                    {isAdmin ? (
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!r.paid}
                          onChange={() => handlePaidToggle(r.id, !r.paid)}
                          className="rounded border-slate-500"
                        />
                        {r.paid ? (
                          'Paid'
                        ) : (
                          <span className="text-amber-300 flex items-center gap-1">
                            ⚠ Unpaid <span className="text-xs text-amber-200">(Pay ASAP)</span>
                          </span>
                        )}
                      </label>
                    ) : r.paid ? (
                      '✔ Paid'
                    ) : (
                      <span className="text-amber-300">⚠ Pending admin</span>
                    )}
                  </td>
                  {isAdmin ? (
                    <td className="py-2 text-slate-400 max-w-[180px] text-xs">{r.notes || '—'}</td>
                  ) : rows.some((x) => x.notes) ? (
                    <td className="py-2 text-slate-400 max-w-[180px] text-xs">{r.notes || '—'}</td>
                  ) : null}
                </>
              )}
              <td className="py-2 text-slate-400">{format(new Date(r.date), 'MMM d, yyyy')}</td>
              {isAdmin && (
                <td className="py-2">
                  <span className="inline-flex items-center gap-1.5 flex-wrap">
                    {editingId === r.id ? (
                      <button type="button" className="text-xs btn-primary py-1 px-2" onClick={() => handleSaveEdit(r.id)}>
                        Save
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-xs btn-secondary py-1 px-2"
                        onClick={() => {
                          setEditingId(r.id);
                          setEditAmount(String(r.amount));
                        }}
                      >
                        Change
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteContribution(r.id)}
                      className="inline-flex items-center justify-center p-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/40"
                      title="Delete this record"
                      aria-label="Delete contribution"
                    >
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
                    </button>
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {(isAdmin || viewerMode) && hasMore && (
        <button
          type="button"
          onClick={() => setViewMore(!viewMore)}
          className="text-sm text-[var(--pirate-yellow)] hover:underline"
        >
          {viewMore ? 'Show less' : 'View more'}
        </button>
      )}
      <p className="font-semibold" style={{ color: 'var(--pirate-yellow)' }}>
        Total: ${total.toFixed(2)}
      </p>

      {viewerMode && !isAdmin && (
        <form onSubmit={handleAdd} className="flex flex-col gap-3 pt-4 border-t border-slate-600">
          <p className="text-xs text-slate-400">
            Your account name is used for <strong>Player name</strong>. Enter amount, optional note, then Add. Admin
            marks paid when received.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:items-end">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-xs text-slate-500">Amount ($)</span>
              <input
                type="number"
                step="0.01"
                className="input-field w-full sm:w-36"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <span className="text-xs text-slate-500">Note (optional)</span>
              <input
                className="input-field w-full"
                placeholder="Match fee, donation, etc."
                value={viewerReason}
                onChange={(e) => setViewerReason(e.target.value)}
                maxLength={500}
              />
            </div>
            <button type="submit" className="btn-primary self-start sm:self-end shrink-0" disabled={loading}>
              {loading ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {isAdmin && (
        <form onSubmit={handleAdd} className="flex flex-col gap-3 pt-4 border-t border-slate-600">
          <div className="max-w-lg space-y-1.5">
            <label className="block text-sm text-slate-300 font-medium" htmlFor="admin-player-name-input">
              Player name
            </label>
            <p className="text-[11px] text-slate-500">
              Type a name, or use the arrow in the field to pick from the roster.
            </p>
            <div ref={adminRosterWrapRef} className="relative">
              <input
                id="admin-player-name-input"
                className="input-field w-full pr-11 py-2.5"
                placeholder="Enter name"
                value={adminPlayerName}
                onChange={(e) => setAdminPlayerName(e.target.value)}
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={adminRosterOpen}
                aria-controls="admin-roster-listbox"
                required
              />
              {rosterPlayerNames.length > 0 && (
                <>
                  <button
                    type="button"
                    className="absolute right-1.5 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-[var(--pirate-yellow)] hover:bg-slate-700/80 focus:outline-none focus:ring-2 focus:ring-[var(--pirate-yellow)]/50"
                    onClick={() => setAdminRosterOpen((o) => !o)}
                    aria-label="Open roster list"
                    title="Choose from roster"
                  >
                    <ChevronDownIcon className="h-5 w-5 shrink-0" />
                  </button>
                  {adminRosterOpen && (
                    <ul
                      id="admin-roster-listbox"
                      role="listbox"
                      className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-48 overflow-auto rounded-lg border border-slate-600 bg-slate-900 py-1 shadow-lg"
                    >
                      {rosterPlayerNames.map((n) => (
                        <li key={n} role="option">
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-700/80"
                            onClick={() => {
                              setAdminPlayerName(n);
                              setAdminRosterOpen(false);
                            }}
                          >
                            {n}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <input
              type="number"
              step="0.01"
              className="input-field w-24"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <label className="flex items-center gap-2 text-slate-300">
              <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
              Paid
            </label>
            <button type="submit" className="btn-primary" disabled={loading}>
              Add
            </button>
          </div>
          <input
            className="input-field w-full max-w-md"
            placeholder="Optional note (e.g. cash, Venmo)"
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            maxLength={500}
          />
        </form>
      )}
    </div>
  );
}

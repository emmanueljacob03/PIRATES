'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Contribution } from '@/types/database';
import { format } from 'date-fns';

export default function BudgetContributions({ initial, isAdmin }: { initial: Contribution[]; isAdmin?: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [playerName, setPlayerName] = useState('');
  const [amount, setAmount] = useState('');
  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewMore, setViewMore] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const sortedRows = useMemo(() => {
    const copy = [...rows];
    // Paid first, unpaid at the bottom. Within each group, show latest dates first.
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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!playerName.trim() || !amount) return;
    const amt = parseFloat(amount);
    if (isNaN(amt)) return;
    setLoading(true);
    if (isAdmin) {
      const res = await fetch('/api/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: playerName.trim(),
          amount: amt,
          paid,
          date: new Date().toISOString().slice(0, 10),
        }),
      });
      const data = await res.json().catch(() => null);
      setLoading(false);
      if (data?.id) {
        setRows((prev) => [data, ...prev]);
        setPlayerName('');
        setAmount('');
        setPaid(false);
        router.refresh();
      }
      return;
    }
    const { data, error } = await (supabase as any)
      .from('contributions')
      .insert({
        player_name: playerName.trim(),
        amount: amt,
        paid,
        date: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();
    setLoading(false);
    if (!error && data) {
      setRows((prev) => [data, ...prev]);
      setPlayerName('');
      setAmount('');
      setPaid(false);
      router.refresh();
    }
  }

  async function handleSaveEdit(id: string) {
    const amt = parseFloat(editAmount);
    if (isNaN(amt)) return;
    const res = await fetch('/api/contributions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, amount: amt }) });
    const data = await res.json().catch(() => null);
    if (data?.id) {
      setRows((prev) => prev.map((r) => (r.id === id ? data : r)));
      setEditingId(null);
      setEditAmount('');
    }
  }

  async function handlePaidToggle(id: string, paid: boolean) {
    const res = await fetch('/api/contributions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, paid }) });
    const data = await res.json().catch(() => null);
    if (data?.id) setRows((prev) => prev.map((r) => (r.id === id ? data : r)));
  }

  return (
    <div className="space-y-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-600">
            <th className="pb-2">Player</th>
            <th className="pb-2">Match Fee</th>
            <th className="pb-2">Paid</th>
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
                  `$${Number(r.amount).toFixed(2)}`
                )}
              </td>
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
                ) : (
                  r.paid ? '✔ Paid' : <span className="text-amber-300">⚠ Pay ASAP</span>
                )}
              </td>
              <td className="py-2 text-slate-400">{format(new Date(r.date), 'MMM d, yyyy')}</td>
              {isAdmin && (
                <td className="py-2">
                  {editingId === r.id ? (
                    <button type="button" className="text-xs btn-primary py-1 px-2" onClick={() => handleSaveEdit(r.id)}>
                      Save
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-xs btn-secondary py-1 px-2"
                      onClick={() => { setEditingId(r.id); setEditAmount(String(r.amount)); }}
                    >
                      Change
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {isAdmin && hasMore && (
        <button type="button" onClick={() => setViewMore(!viewMore)} className="text-sm text-[var(--pirate-yellow)] hover:underline">
          {viewMore ? 'Show less' : 'View more'}
        </button>
      )}
      <p className="font-semibold" style={{ color: 'var(--pirate-yellow)' }}>Total: ${total.toFixed(2)}</p>

      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-end pt-4 border-t border-slate-600">
        <input
          className="input-field flex-1 min-w-[120px]"
          placeholder="Player name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          required
        />
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
        <button type="submit" className="btn-primary" disabled={loading}>Add</button>
      </form>
    </div>
  );
}

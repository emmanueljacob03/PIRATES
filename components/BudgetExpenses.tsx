'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type ExpenseRow = {
  id: string;
  category: string;
  item: string;
  cost: number;
  bought?: boolean;
  submitted_by_name?: string | null;
};

const VISIBLE_INITIAL = 5;

export default function BudgetExpenses({
  initial,
  isAdmin,
  hideTeamTotal = false,
}: {
  initial: ExpenseRow[];
  isAdmin?: boolean;
  /** Hide approved-expenses sum (e.g. viewers: no team totals). */
  hideTeamTotal?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [category, setCategory] = useState('');
  const [item, setItem] = useState('');
  const [cost, setCost] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const total = rows.filter((r) => !!r.bought).reduce((s, r) => s + Number(r.cost), 0);
  const visibleRows = showAll ? rows : rows.slice(0, VISIBLE_INITIAL);
  const hasMore = rows.length > VISIBLE_INITIAL;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!category.trim() || !item.trim() || !cost) return;
    const costNum = parseFloat(cost);
    if (isNaN(costNum)) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: category.trim(), item: item.trim(), cost: costNum }),
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setError((data?.error as string) || `Failed (${res.status})`);
        return;
      }
      if (data?.id) {
        setRows((prev) => [data as ExpenseRow, ...prev]);
        setCategory('');
        setItem('');
        setCost('');
        router.refresh();
      } else {
        setError('Server did not return the new expense.');
      }
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Request failed');
    }
  }

  async function toggleBought(id: string, bought: boolean) {
    if (!isAdmin) return;
    const res = await fetch('/api/expenses', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, bought }) });
    const data = await res.json().catch(() => null);
    if (data?.id) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, bought } : r)));
      router.refresh();
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    setError(null);
    if (!isAdmin && deletingId !== null) return;
    if (!window.confirm('Delete this expense?')) return;
    setDeletingId(expenseId);
    try {
      const res = await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE', credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string })?.error || res.statusText);
      setRows((prev) => prev.filter((r) => r.id !== expenseId));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-600">
            <th className="pb-2">Category</th>
            <th className="pb-2">Item</th>
            <th className="pb-2">Cost</th>
            <th className="pb-2 w-20">Bought</th>
            {isAdmin && <th className="pb-2 w-10">Delete</th>}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((r) => (
            <tr
              key={r.id}
              className={`border-b border-slate-700/50 ${!r.bought ? 'opacity-60 bg-slate-900/20' : ''}`}
            >
              <td className="py-2">{r.category}</td>
              <td className="py-2">{r.item}</td>
              <td className="py-2">${Number(r.cost).toFixed(2)}</td>
              <td className="py-2">
                {isAdmin ? (
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!r.bought}
                      onChange={(e) => toggleBought(r.id, e.target.checked)}
                    />
                    <span className="text-xs text-slate-500">{r.bought ? 'Bought' : '—'}</span>
                  </label>
                ) : r.bought ? (
                  <span className="text-xs text-slate-400">Approved</span>
                ) : (
                  <span className="text-xs text-slate-400 flex items-center gap-1">⚠ Waiting approval</span>
                )}
              </td>
              {isAdmin && (
                <td className="py-2">
                  <button
                    type="button"
                    disabled={deletingId === r.id}
                    onClick={() => handleDeleteExpense(r.id)}
                    className="inline-flex items-center justify-center p-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/40 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Delete expense"
                    title="Delete expense"
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
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="text-amber-400 hover:underline text-sm">
          {showAll ? 'Show less' : 'View more'}
        </button>
      )}
      {!hideTeamTotal && (
        <p className="font-semibold text-amber-400">Total expenses (approved): ${total.toFixed(2)}</p>
      )}

      {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-end pt-4 border-t border-slate-600">
        <input
          className="input-field flex-1 min-w-[100px]"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        />
        <input
          className="input-field flex-1 min-w-[100px]"
          placeholder="Item"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          required
        />
        <input
          type="number"
          step="0.01"
          className="input-field w-24"
          placeholder="Cost"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          required
        />
        <button type="submit" className="btn-primary" disabled={loading}>Add</button>
      </form>
    </div>
  );
}

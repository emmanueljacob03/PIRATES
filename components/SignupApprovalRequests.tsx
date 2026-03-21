'use client';

import { useCallback, useEffect, useState } from 'react';

type PendingRow = { id: string; email: string; name: string | null; created_at: string };

export default function SignupApprovalRequests() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    fetch('/api/pending-approvals', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: unknown) => {
        if (Array.isArray(data)) setItems(data as PendingRow[]);
        else setItems([]);
      })
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, [load]);

  async function act(userId: string, action: 'approve' | 'reject') {
    setLoading(true);
    try {
      const res = await fetch('/api/pending-approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ userId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed');
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const count = items.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg border border-slate-600 bg-slate-800/80 text-slate-200 hover:border-amber-500/50 hover:text-white text-sm min-w-[2.5rem]"
        aria-expanded={open}
        aria-label="Sign-up requests pending approval"
        title="Sign-up requests (pending approval)"
      >
        <span className="text-base leading-none" aria-hidden>
          👤+
        </span>
        {count > 0 && (
          <span className="min-w-[1.25rem] rounded-full bg-amber-500 text-slate-900 text-xs font-bold px-1 text-center">
            {count}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/40 sm:hidden"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-full mt-2 z-[70] w-[min(100vw-2rem,22rem)] rounded-xl border border-slate-600 bg-slate-900 shadow-xl p-3 max-h-[70vh] overflow-y-auto"
            role="dialog"
            aria-label="Pending account approvals"
          >
            <p className="text-xs text-slate-400 mb-2">Accounts waiting for approval</p>
            {items.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No pending requests.</p>
            ) : (
              <ul className="space-y-2">
                {items.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-lg border border-slate-700 bg-slate-800/80 p-2.5 flex flex-col gap-2"
                  >
                    <div>
                      <p className="font-medium text-white text-sm">{row.name || '—'}</p>
                      <p className="text-xs text-slate-400 truncate" title={row.email}>
                        {row.email}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void act(row.id, 'approve')}
                        className="flex-1 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void act(row.id, 'reject')}
                        className="flex-1 py-1.5 rounded-md bg-red-700 hover:bg-red-600 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

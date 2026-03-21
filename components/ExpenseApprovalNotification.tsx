'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type PendingByName = { name: string; count: number };

export default function ExpenseApprovalNotification() {
  const [pending, setPending] = useState<PendingByName[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/pending-expenses', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((data) => {
        if (!alive) return;
        if (Array.isArray(data)) setPending(data);
      })
      .catch(() => {
        if (!alive) return;
        setPending([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!pending || pending.length === 0) return null;

  const first = pending[0];
  const restCount = pending.length - 1;

  return (
    <Link
      href="/budget"
      className="flex items-start gap-2 px-3 py-2 rounded-lg border border-amber-500/50 bg-slate-800/80 text-slate-200 hover:text-white transition"
      aria-label="Expense approval needed"
    >
      <span aria-hidden className="text-lg leading-none">
        ⚠
      </span>
      <div className="flex flex-col">
        <span className="text-xs font-semibold leading-4">
          {first.name} added {first.count} expense{first.count === 1 ? '' : 's'} — please approve
        </span>
        {restCount > 0 && (
          <span className="text-[11px] text-slate-400 leading-4">+{restCount} more</span>
        )}
      </div>
    </Link>
  );
}


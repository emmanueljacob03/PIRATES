'use client';

import { useState } from 'react';

export type PendingRow = { name: string; jersey: number; contribution: number; total: number };

export default function TotalPendingCard({ pendingByPlayer }: { pendingByPlayer: PendingRow[] }) {
  const [open, setOpen] = useState(false);
  const total = pendingByPlayer.reduce((s, p) => s + p.total, 0);

  return (
    <div className="card card-hover-lift cursor-pointer" onClick={() => setOpen((o) => !o)}>
      <p className="text-slate-400 text-sm">Total pending amounts</p>
      <p className="text-xl font-semibold text-white mt-1">${total.toFixed(0)}</p>
      {open && pendingByPlayer.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-600 space-y-2">
          {pendingByPlayer.map((p) => (
            <div key={p.name} className="text-sm">
              <p className="font-medium text-white">{p.name}: ${p.total.toFixed(0)} total</p>
              <p className="text-slate-400">
                {p.jersey > 0 && `${p.jersey.toFixed(0)} jersey`}
                {p.jersey > 0 && p.contribution > 0 && ' + '}
                {p.contribution > 0 && `${p.contribution.toFixed(2)} match fee`}
              </p>
            </div>
          ))}
        </div>
      )}
      {open && pendingByPlayer.length === 0 && (
        <p className="text-slate-400 text-sm mt-2">No pending amounts.</p>
      )}
    </div>
  );
}

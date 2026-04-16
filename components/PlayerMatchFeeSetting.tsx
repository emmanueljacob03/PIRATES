'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Admin: set standard player match fee (Team Budget → same meaning as profile WHAT YOU OWE). */
export default function PlayerMatchFeeSetting({
  initialFormatted,
}: {
  /** e.g. "120.00" from server */
  initialFormatted: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialFormatted);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setValue(initialFormatted);
  }, [initialFormatted]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/player-match-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage((data as { error?: string }).error ?? 'Save failed');
        return;
      }
      const next = typeof (data as { value?: string }).value === 'string' ? (data as { value: string }).value : value;
      setValue(parseFloat(next).toFixed(2));
      setMessage('Saved.');
      router.refresh();
      window.setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-600/60 bg-slate-900/40 p-3 mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-2">Standard player match fee</p>
      <p className="text-slate-500 text-xs mb-2">
        Shown on each profile under WHAT YOU OWE (Player match fee). Ledger lines below are per-player payments.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-400 text-sm">$</span>
        <input
          type="text"
          inputMode="decimal"
          className="input-field w-28 py-1.5 text-sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Standard player match fee amount"
        />
        <button type="button" className="btn-secondary text-xs py-1 px-2" disabled={saving} onClick={() => void save()}>
          {saving ? '…' : 'Save'}
        </button>
      </div>
      {message ? <p className="text-xs mt-2 text-emerald-400/90">{message}</p> : null}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DesiredCollectionCard({ isAdmin, initialValue }: { isAdmin: boolean; initialValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch('/api/desired-collection', { cache: 'no-store' });
    const data = await res.json();
    if (typeof data?.value === 'string') {
      const next = data.value.trim() || '0.00';
      setValue(next);
      setInputVal(next);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/desired-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: inputVal }),
      });
      const data = await res.json();
      if (data?.value !== undefined) {
        const next = String(data.value);
        setValue(next);
        setInputVal(next);
        setEditing(false);
        await load();
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  const display = value.startsWith('$') ? value : `$${value}`;

  return (
    <div className="card card-hover-lift">
      <p className="text-slate-400 text-sm">Desired collections (Current Season)</p>
      {editing && isAdmin ? (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-white">$</span>
          <input
            type="text"
            className="input-field w-24 py-1 text-lg"
            value={inputVal.replace(/^\$/, '')}
            onChange={(e) => setInputVal(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
          />
          <button type="button" onClick={handleSave} className="btn-primary text-sm py-1" disabled={saving}>
            {saving ? '…' : 'Save'}
          </button>
          <button type="button" onClick={() => { setEditing(false); setInputVal(value); }} className="btn-secondary text-sm py-1">Cancel</button>
        </div>
      ) : (
        <p className="text-xl font-semibold text-white mt-1 flex items-center gap-2">
          {display}
          {isAdmin && (
            <button type="button" onClick={() => setEditing(true)} className="text-sm text-[var(--pirate-yellow)] hover:underline">
              Edit
            </button>
          )}
        </p>
      )}
    </div>
  );
}

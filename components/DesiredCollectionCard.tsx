'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DesiredCollectionCard({ isAdmin, initialValue }: { isAdmin: boolean; initialValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [persistWarning, setPersistWarning] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/desired-collection', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: inputVal }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert((data as { error?: string })?.error ?? 'Could not save desired collection.');
        return;
      }
      if (data?.value !== undefined) {
        const next = String(data.value);
        setValue(next);
        setInputVal(next);
        setEditing(false);
        if ((data as { persisted?: boolean }).persisted === false) {
          const d = (data as { detail?: string }).detail;
          setPersistWarning(
            d ??
              'Value did not save to the database. Set SUPABASE_SERVICE_ROLE_KEY on the host and run the SQL migration for desired_collection.',
          );
        } else {
          setPersistWarning(null);
        }
        // Do not GET /api/desired-collection here: on serverless, read can return 0.00 from another
        // instance’s empty .data file and overwrite the value we just set from this POST response.
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
      {persistWarning && isAdmin && (
        <p className="text-xs text-amber-400 mt-2 leading-snug">{persistWarning}</p>
      )}
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

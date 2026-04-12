'use client';

import { useState } from 'react';
import type { Jersey } from '@/types/database';
import { NEW_JERSEY_AMOUNT_USD } from '@/lib/jersey-utils';

export default function JerseyRequestForm({
  onSuccess,
  existingJerseyNumbers,
}: {
  onSuccess?: (jersey: Jersey) => void;
  existingJerseyNumbers?: string[];
}) {
  const [requestType, setRequestType] = useState<'existing' | 'new'>('new');
  const [playerName, setPlayerName] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [size, setSize] = useState('M');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const usedNumbers = existingJerseyNumbers ?? [];
  const isExisting = requestType === 'existing';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numRaw = jerseyNumber.trim();
    if (!/^\d{1,4}$/.test(numRaw)) {
      setMessage({ type: 'err', text: 'Jersey number must be 1–4 digits (e.g. 06 or 7).' });
      return;
    }
    if (usedNumbers.includes(numRaw)) {
      setMessage({ type: 'err', text: 'This jersey number is already taken. Choose another.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const noteText = notes.trim() ? `[${requestType}] ${notes.trim()}` : `[${requestType}]`;
      const paid = isExisting;
      const res = await fetch('/api/jerseys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: playerName.trim(),
          jersey_number: numRaw,
          size,
          paid,
          notes: noteText,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error ?? res.statusText;
        if (String(msg).toLowerCase().includes('already') || res.status === 400) {
          setMessage({ type: 'err', text: 'Number already taken or invalid.' });
          return;
        }
        throw new Error(msg);
      }
      setMessage({ type: 'ok', text: isExisting ? 'Jersey recorded (Paid).' : `Jersey request saved (Unpaid $${NEW_JERSEY_AMOUNT_USD}). It appears in Jersey Lookup.` });
      if (data?.id) onSuccess?.(data as Jersey);
      setPlayerName('');
      setJerseyNumber('');
      setNotes('');
    } catch (err: unknown) {
      setMessage({ type: 'err', text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center flex-wrap">
        <button
          type="button"
          onClick={() => setRequestType('existing')}
          className={`text-sm py-1.5 px-3 rounded border ${requestType === 'existing' ? 'bg-[var(--pirate-yellow)] text-black border-[var(--pirate-yellow)]' : 'border-slate-500 text-slate-300 hover:border-slate-400'}`}
        >
          Existing
        </button>
        <button
          type="button"
          onClick={() => setRequestType('new')}
          className={`text-sm py-1.5 px-3 rounded border ${requestType === 'new' ? 'bg-[var(--pirate-yellow)] text-black border-[var(--pirate-yellow)]' : 'border-slate-500 text-slate-300 hover:border-slate-400'}`}
        >
          New
        </button>
        <span className="text-sm text-slate-400">
          {isExisting ? 'Paid' : `Unpaid $${NEW_JERSEY_AMOUNT_USD}`}
        </span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <p className={`text-sm ${message.type === 'err' ? 'text-red-400' : 'text-green-400'}`}>
          {message.text}
        </p>
      )}
      <div>
        <label className="block text-sm text-slate-300 mb-1">Player Name</label>
        <input
          className="input-field"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-sm text-slate-300 mb-1">Jersey Number</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{1,4}"
          maxLength={4}
          className="input-field"
          placeholder="e.g. 06 or 7"
          value={jerseyNumber}
          onChange={(e) => setJerseyNumber(e.target.value.replace(/\D/g, '').slice(0, 4))}
          required
        />
        <p className="text-slate-500 text-xs mt-1">Leading zeros are kept (06 is not the same as 6).</p>
      </div>
      <div>
        <label className="block text-sm text-slate-300 mb-1">Size</label>
        <select
          className="input-field"
          value={size}
          onChange={(e) => setSize(e.target.value)}
        >
          {['S', 'M', 'L', 'XL', 'XXL'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm text-slate-300 mb-1">Notes</label>
        <textarea
          className="input-field min-h-[80px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? 'Saving...' : 'Submit Request'}
      </button>
    </form>
    </div>
  );
}

'use client';

import { useState } from 'react';
import type { Jersey } from '@/types/database';

const NEW_JERSEY_AMOUNT = 50;

export default function JerseyRequestForm({ onSuccess, existingJerseyNumbers }: { onSuccess?: (jersey: Jersey) => void; existingJerseyNumbers?: number[] }) {
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
    const num = parseInt(jerseyNumber, 10);
    if (usedNumbers.includes(num)) {
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
          jersey_number: num,
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
      setMessage({ type: 'ok', text: isExisting ? 'Jersey recorded (Paid).' : `Jersey request saved (Unpaid $${NEW_JERSEY_AMOUNT}). It appears in Jersey Lookup.` });
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
          {isExisting ? 'Paid' : `Unpaid $${NEW_JERSEY_AMOUNT}`}
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
          type="number"
          min="1"
          max="999"
          className="input-field"
          value={jerseyNumber}
          onChange={(e) => setJerseyNumber(e.target.value)}
          required
        />
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

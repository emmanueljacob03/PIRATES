'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AddMatchForm() {
  const router = useRouter();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('14:00');
  const [opponent, setOpponent] = useState('');
  const [ground, setGround] = useState('');
  const [isPractice, setIsPractice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          time,
          opponent: isPractice ? 'Practice Session' : opponent.trim(),
          ground: ground.trim(),
          isPractice,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || res.statusText);
      setMessage({ type: 'ok', text: isPractice ? 'Practice session added.' : 'Match added.' });
      setDate('');
      setOpponent('');
      setGround('');
      router.refresh();
    } catch (err: unknown) {
      setMessage({ type: 'err', text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <p className={`text-sm ${message.type === 'err' ? 'text-red-400' : 'text-green-400'}`}>
          {message.text}
        </p>
      )}
      <div>
        <label className="block text-sm text-slate-300 mb-1">Date</label>
        <input
          type="date"
          className="input-field"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-sm text-slate-300 mb-1">Time</label>
        <input
          type="time"
          className="input-field"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm text-slate-300 mb-1">Opponent</label>
        <input
          className="input-field"
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-sm text-slate-300 mb-1">Ground</label>
        <input
          className="input-field"
          value={ground}
          onChange={(e) => setGround(e.target.value)}
          placeholder="City/venue for weather"
        />
      </div>
      <label className="flex items-center gap-2 text-slate-300">
        <input type="checkbox" checked={isPractice} onChange={(e) => setIsPractice(e.target.checked)} />
        Practice match
      </label>
      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? 'Adding...' : 'Add Match'}
      </button>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function AddPlayerForm() {
  const [name, setName] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [role, setRole] = useState('Player');
  const [photoUrl, setPhotoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      // @ts-expect-error Supabase client generic inference
      const { error } = await supabase.from('players').insert({
        name: name.trim(),
        jersey_number: jerseyNumber ? parseInt(jerseyNumber, 10) : null,
        role: role.trim() || 'Player',
        photo: photoUrl.trim() || null,
      });
      if (error) throw error;
      setMessage({ type: 'ok', text: 'Player added.' });
      setName('');
      setJerseyNumber('');
      setPhotoUrl('');
      router.refresh();
    } catch (err: unknown) {
      setMessage({ type: 'err', text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card mb-8">
      <h3 className="text-lg font-semibold mb-4">Add Player</h3>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        {message && (
          <p className={`text-sm ${message.type === 'err' ? 'text-red-400' : 'text-green-400'}`}>
            {message.text}
          </p>
        )}
        <div>
          <label className="block text-sm text-slate-300 mb-1">Name</label>
          <input
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Jersey Number</label>
          <input
            type="number"
            min="0"
            className="input-field"
            value={jerseyNumber}
            onChange={(e) => setJerseyNumber(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Role</label>
          <input
            className="input-field"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Batsman, Bowler"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Photo URL</label>
          <input
            className="input-field"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="Image URL"
          />
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Adding...' : 'Add Player'}
        </button>
      </form>
    </div>
  );
}

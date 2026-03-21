'use client';

import { useState } from 'react';
import { submitTeamCodeAndGoDashboard } from '@/lib/team-code-submit';

export default function CodePageTeamForm() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!code.trim()) {
      setError('Enter the code.');
      return;
    }
    setLoading(true);
    const result = await submitTeamCodeAndGoDashboard(code);
    if (result === 'ok') return;
    setLoading(false);
    if (result === 'invalid') setError('Wrong code.');
    else setError('Network error. Try again.');
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code"
          className="input-field flex-1 py-2.5"
          autoFocus
          autoComplete="off"
        />
        <button type="submit" className="btn-primary py-2.5 px-4 shrink-0" disabled={loading}>
          {loading ? '…' : 'Go'}
        </button>
      </div>
      {error ? <p className="text-red-400 text-sm text-left">{error}</p> : null}
    </form>
  );
}

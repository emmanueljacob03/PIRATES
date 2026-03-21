'use client';

import { useState } from 'react';

export default function CodeGate() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim() }),
      credentials: 'same-origin',
    });
    if (!res.ok) {
      setError('Wrong security code. Only players with the code can enter.');
      return;
    }
    window.location.href = '/dashboard';
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-pirate-dark">
      <div className="absolute inset-0 bg-gradient-to-b from-pirate-dark/95 to-pirate-navy/95" />
      <div className="relative z-10 w-full max-w-sm mx-4 card">
        <h2 className="text-xl font-semibold text-pirate-gold mb-2">Enter Pirates Security Code</h2>
        <p className="text-slate-400 text-sm mb-4">Only players with the code can access the dashboard.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            className="input-field"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Security code"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full">Enter</button>
        </form>
      </div>
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import JerseyLookup from '@/components/JerseyLookup';
import JerseyRequestForm from '@/components/JerseyRequestForm';
import type { Jersey } from '@/types/database';

function downloadJerseyCsv(jerseys: Jersey[]) {
  const headers = 'Player Name,Jersey Number,Size,Paid,Notes,Created At';
  const rows = jerseys.map((j) => [
    `"${(j.player_name ?? '').replace(/"/g, '""')}"`,
    j.jersey_number,
    j.size,
    j.paid ? 'Yes' : 'No',
    `"${(j.notes ?? '').replace(/"/g, '""')}"`,
    j.created_at,
  ].join(','));
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jersey-list-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function JerseysPageClient({ initial, isAdmin }: { initial: Jersey[]; isAdmin?: boolean }) {
  const [jerseys, setJerseys] = useState(initial);

  const handleNewJersey = useCallback((jersey: Jersey) => {
    setJerseys((prev) => [jersey, ...prev].sort((a, b) => a.jersey_number - b.jersey_number));
  }, []);

  const handlePaidToggle = useCallback(async (id: string, paid: boolean) => {
    const res = await fetch('/api/jerseys', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, paid }) });
    if (!res.ok) return;
    setJerseys((prev) => prev.map((j) => (j.id === id ? { ...j, paid } : j)));
  }, []);

  const handleDeleteJersey = useCallback(async (id: string) => {
    if (!isAdmin) return;
    const res = await fetch(`/api/jerseys/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (!res.ok) return;
    setJerseys((prev) => prev.filter((j) => j.id !== id));
  }, [isAdmin]);

  const existingNumbers = jerseys.map((j) => j.jersey_number);

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="card">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-lg font-semibold">Jersey Lookup</h3>
          <button type="button" onClick={() => downloadJerseyCsv(jerseys)} className="text-sm btn-secondary py-1 px-2">
            Download CSV
          </button>
        </div>
        <JerseyLookup
          jerseys={jerseys}
          isAdmin={isAdmin}
          onPaidToggle={isAdmin ? handlePaidToggle : undefined}
          onDeleteJersey={isAdmin ? handleDeleteJersey : undefined}
        />
      </div>
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Request New Jersey</h3>
        <JerseyRequestForm onSuccess={handleNewJersey} existingJerseyNumbers={existingNumbers} />
      </div>
    </div>
  );
}

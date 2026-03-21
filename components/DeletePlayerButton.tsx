'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeletePlayerButton({ playerId, playerName }: { playerId: string; playerName: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Remove ${playerName} from the team? This also removes them from all Playing 11 lineups.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/players/${playerId}`, { method: 'DELETE', credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Delete failed');
      router.refresh();
      window.dispatchEvent(new Event('playing11-updated'));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void handleDelete();
      }}
      disabled={loading}
      className="absolute top-2 left-2 z-[45] flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white text-sm font-bold leading-none shadow-md hover:bg-red-500 hover:scale-105 disabled:opacity-60 disabled:hover:scale-100"
      title={`Remove ${playerName}`}
      aria-label={`Remove player ${playerName}`}
    >
      ×
    </button>
  );
}

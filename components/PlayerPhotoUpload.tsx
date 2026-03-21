'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PlayerPhotoUpload({
  playerId,
  playerName,
  compact = false,
}: {
  playerId: string;
  playerName: string;
  compact?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  async function uploadFile(file: File) {
    if (!file) return;
    setLoading(true);
    setMessage('');
    try {
      const ext = file.name.split('.').pop() || 'png';
      const formData = new FormData();
      formData.append('player_id', playerId);
      formData.append('file', file);
      formData.append('ext', ext);
      const res = await fetch('/api/players/photo', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      if (data?.photo) setPreviewUrl(String(data.photo));
      setMessage('Photo uploaded.');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      router.refresh();
    } catch (err: unknown) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    if (chosen) {
      setFile(chosen);
      uploadFile(chosen);
    }
  }

  return (
    <form className="mt-3 space-y-2 text-left" onSubmit={(e) => e.preventDefault()}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileSelected}
      />
      <button
        type="button"
        className={
          compact
            ? 'inline-flex items-center justify-center min-w-[2rem] min-h-[2rem] rounded-lg bg-black/55 text-slate-100 hover:bg-black/75 border border-white/20 text-lg font-light leading-none px-2 py-1 transition'
            : 'w-full h-full rounded-lg border border-dashed border-slate-500/70 bg-slate-800/40 hover:border-amber-400 hover:bg-slate-800 transition p-0 text-center overflow-hidden'
        }
        disabled={loading}
        aria-label={loading ? 'Uploading photo' : 'Add or change photo'}
        title={loading ? 'Uploading…' : 'Add or change photo'}
        onClick={() => fileInputRef.current?.click()}
      >
        {compact ? (
          <span aria-hidden>{loading ? '…' : '+'}</span>
        ) : (
          <>
            {previewUrl ? (
              <img src={previewUrl} alt={playerName} className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center gap-1 w-full h-full px-2">
                <span className="text-2xl leading-none text-amber-400">{loading ? '...' : '+'}</span>
                <span className="text-xs text-slate-300">{loading ? 'Uploading...' : 'Add photo'}</span>
              </div>
            )}
          </>
        )}
      </button>
    </form>
  );
}

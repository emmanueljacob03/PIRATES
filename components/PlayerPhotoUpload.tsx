'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { compressImageForUpload } from '@/lib/image-compress';

const UPLOAD_TIMEOUT_MS = 120_000;

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
  const [savedFlash, setSavedFlash] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  async function uploadFile(file: File) {
    if (!file) return;
    setLoading(true);
    setMessage('');
    setSavedFlash(false);
    const ac = new AbortController();
    const t = window.setTimeout(() => ac.abort(), UPLOAD_TIMEOUT_MS);
    try {
      const compressed = await compressImageForUpload(file, { maxBytes: 1_600_000, maxEdge: 1600 });
      const ext = compressed.name.split('.').pop() || 'jpg';
      const formData = new FormData();
      formData.append('player_id', playerId);
      formData.append('file', compressed);
      formData.append('ext', ext);
      const res = await fetch('/api/players/photo', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        signal: ac.signal,
      });
      const text = await res.text();
      let data: { error?: string; photo?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        if (!res.ok) throw new Error(text.slice(0, 200) || `Upload failed (${res.status})`);
      }
      if (!res.ok) {
        const hint =
          res.status === 413 || text.includes('FUNCTION_PAYLOAD_TOO_LARGE') || text.includes('Too Large')
            ? ' Image was still too large — try another photo or take a new picture at lower quality.'
            : '';
        throw new Error((data?.error || `Upload failed (${res.status})`) + hint);
      }
      if (data?.photo) setPreviewUrl(String(data.photo));
      setMessage('Saved.');
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 3500);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      router.refresh();
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.name === 'AbortError'
          ? 'Upload timed out. Try a smaller image or check your connection.'
          : (err as Error).message;
      setMessage(msg);
      if (compact && typeof window !== 'undefined') window.alert(msg);
    } finally {
      window.clearTimeout(t);
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
    <form
      className={compact ? 'relative m-0 inline-block' : 'mt-3 space-y-2 text-left'}
      onSubmit={(e) => e.preventDefault()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileSelected}
      />
      {message && !compact ? (
        <p className={`text-xs ${message.includes('failed') || message.includes('timed') || message.includes('Not allowed') ? 'text-red-400' : 'text-green-400'}`}>
          {message}
        </p>
      ) : null}
      <button
        type="button"
        className={
          compact
            ? 'inline-flex items-center justify-center min-w-[2.25rem] min-h-[2.25rem] rounded-md bg-black/60 text-amber-300 hover:bg-black/80 border border-amber-500/40 text-base leading-none p-1.5 transition shadow-sm'
            : 'w-full h-full rounded-lg border border-dashed border-slate-500/70 bg-slate-800/40 hover:border-amber-400 hover:bg-slate-800 transition p-0 text-center overflow-hidden'
        }
        disabled={loading}
        aria-label={loading ? 'Uploading photo' : 'Change photo'}
        title={loading ? 'Uploading…' : 'Change photo'}
        onClick={() => fileInputRef.current?.click()}
      >
        {compact ? (
          <span aria-hidden className="block scale-110" style={{ fontFamily: 'system-ui' }}>
            {loading ? '…' : '✎'}
          </span>
        ) : (
          <>
            {previewUrl ? (
              <img src={previewUrl} alt={playerName} className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center gap-1 w-full h-full px-2">
                <span className="text-2xl leading-none text-amber-400">{loading ? '...' : '✎'}</span>
                <span className="text-xs text-slate-300">{loading ? 'Uploading...' : 'Add photo'}</span>
              </div>
            )}
          </>
        )}
      </button>
      {message && compact ? (
        <span className="sr-only" role="status">
          {message}
        </span>
      ) : null}
      {compact && savedFlash ? (
        <span
          className="absolute -top-1 -right-1 z-50 whitespace-nowrap rounded bg-emerald-700/95 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow"
          role="status"
        >
          Saved
        </span>
      ) : null}
    </form>
  );
}

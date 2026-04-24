'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { compressImageForUpload } from '@/lib/image-compress';
import { supabase } from '@/lib/supabase';

const UPLOAD_TIMEOUT_MS = 120_000;

/** Uploads to team-level Others (`match_id` null). Team code + sign-in — same API as match media. */
export default function TeamOthersMediaClient({ canUpload = false }: { canUpload?: boolean }) {
  const [type, setType] = useState<'photo' | 'video'>('photo');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setMessage('');
    const ac = new AbortController();
    const t = window.setTimeout(() => ac.abort(), UPLOAD_TIMEOUT_MS);
    try {
      const uploadFile =
        type === 'photo' ? await compressImageForUpload(file, { maxBytes: 1_600_000, maxEdge: 1600 }) : file;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in to upload media.');
      const ext = uploadFile.name.split('.').pop() || (type === 'video' ? 'mp4' : 'jpg');
      const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || (type === 'video' ? 'mp4' : 'jpg');
      const path = `${user.id}/team-media-others/${type}-${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
      const { error: storageError } = await supabase.storage.from('avatars').upload(path, uploadFile, {
        upsert: true,
        contentType: uploadFile.type || (type === 'video' ? 'video/mp4' : 'image/jpeg'),
      });
      if (storageError) throw new Error(storageError.message);
      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(path);
      const res = await fetch('/api/match-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        signal: ac.signal,
        body: JSON.stringify({
          team_others: true,
          type,
          url: publicData.publicUrl,
        }),
      });
      const text = await res.text();
      let data: { error?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        if (!res.ok) throw new Error(text.slice(0, 200) || `Upload failed (${res.status})`);
      }
      if (!res.ok) {
        const hint =
          res.status === 413 || text.includes('FUNCTION_PAYLOAD_TOO_LARGE') || text.includes('Too Large')
            ? ' Photo is too large. Try a smaller image.'
            : '';
        throw new Error((data?.error || `Upload failed (${res.status})`) + hint);
      }
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMessage('Uploaded.');
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'AbortError'
          ? 'Upload timed out. Try a smaller photo or check your connection.'
          : (err as Error).message;
      setMessage(msg);
    } finally {
      window.clearTimeout(t);
      setLoading(false);
    }
  }

  if (!canUpload) return null;

  return (
    <div className="card mb-6 border-amber-500/20">
      <h3 className="text-lg font-semibold mb-4">Upload to Others</h3>
      <p className="text-slate-500 text-sm mb-4">Extra photos and videos not tied to a match (no limit).</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Type</label>
          <select
            className="input-field"
            value={type}
            onChange={(e) => setType(e.target.value as 'photo' | 'video')}
          >
            <option value="photo">Photo</option>
            <option value="video">Video</option>
          </select>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={type === 'video' ? 'video/*,.mov,.mp4' : 'image/*,.heic,.heif'}
          className="input-field"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-slate-500 text-xs">On phone: opens Photos, Files, or camera—pick what your device offers.</p>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
      {message && <p className="text-slate-500 text-sm mt-2">{message}</p>}
    </div>
  );
}

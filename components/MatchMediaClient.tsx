'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MatchMediaClient({ matchId, canUpload = false }: { matchId: string; canUpload?: boolean }) {
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
    try {
      const formData = new FormData();
      formData.append('match_id', matchId);
      formData.append('type', type);
      formData.append('album', 'main');
      formData.append('file', file);
      const res = await fetch('/api/match-media', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMessage('Uploaded.');
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    }
    setLoading(false);
  }

  if (!canUpload) return null;

  return (
    <div className="card mb-6">
      <h3 className="text-lg font-semibold mb-4">Upload Media</h3>
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
          accept={type === 'video' ? 'video/*' : 'image/*'}
          capture="environment"
          className="input-field"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
      {message && <p className="text-slate-500 text-sm mt-2">{message}</p>}
    </div>
  );
}

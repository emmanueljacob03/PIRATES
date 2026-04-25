'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type State = {
  url: string | null;
  active: boolean;
  title: string | null;
  embedUrl: string | null;
};

export default function LiveStreamPageClient({
  isAdmin,
  initial,
  publicWatchPath = '/watch',
}: {
  isAdmin: boolean;
  initial: State;
  publicWatchPath?: string;
}) {
  const router = useRouter();
  const [s, setS] = useState<State>(initial);
  const [urlInput, setUrlInput] = useState(initial.url ?? '');
  const [titleInput, setTitleInput] = useState(initial.title ?? '');
  const [activeInput, setActiveInput] = useState(initial.active);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicLink = origin ? `${origin}${publicWatchPath}` : publicWatchPath;

  const load = useCallback(() => {
    fetch('/api/live-stream', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d: State) => {
        if (d && typeof d === 'object') {
          setS(d);
          setUrlInput(d.url ?? '');
          setTitleInput(d.title ?? '');
          setActiveInput(d.active);
        }
      })
      .catch(() => {});
  }, []);

  async function save(partial: {
    url?: string | null;
    active?: boolean;
    title?: string | null;
  }) {
    if (!isAdmin) return;
    setSaving(true);
    setErr('');
    try {
      const res = await fetch('/api/live-stream', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(partial),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Save failed');
      setS(data as State);
      setUrlInput((data as State).url ?? '');
      setTitleInput((data as State).title ?? '');
      setActiveInput((data as State).active);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl">
      {isAdmin && (
        <div className="card mb-6 border-amber-500/30">
          <h3 className="text-lg font-semibold text-amber-200 mb-2">Admin — live stream</h3>
          <p className="text-slate-400 text-sm mb-4">
            Paste a <strong className="text-slate-300">YouTube</strong> or <strong className="text-slate-300">Vimeo</strong> watch
            or live page URL, then turn the stream on. Anyone can open the public link to watch (no login).
          </p>
          {err ? (
            <p className="text-red-400 text-sm mb-3" role="alert">
              {err}
            </p>
          ) : null}
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Stream URL</label>
              <input
                className="input-field w-full"
                placeholder="https://www.youtube.com/watch?v=… or vimeo.com/…"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Label (optional)</label>
              <input
                className="input-field w-full"
                placeholder="e.g. vs Strikers — T20"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                className="rounded border-slate-500"
                checked={activeInput}
                onChange={(e) => setActiveInput(e.target.checked)}
              />
              Stream is live (show embed to viewers)
            </label>
            <button
              type="button"
              className="btn-primary"
              disabled={saving}
              onClick={() =>
                save({
                  url: urlInput.trim() || null,
                  title: titleInput.trim() || null,
                  active: activeInput,
                })
              }
            >
              {saving ? 'Saving…' : 'Save stream settings'}
            </button>
          </div>
          <p className="text-slate-500 text-xs mt-4 break-all">
            Share with fans: <span className="text-amber-400/90">{publicLink}</span>
          </p>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-1">Current broadcast</h3>
        {s.title ? <p className="text-amber-200/90 text-sm mb-3">{s.title}</p> : null}
        {!s.active || !s.embedUrl ? (
          <p className="text-slate-400">No live stream right now. Check back when the team goes live.</p>
        ) : (
          <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-slate-600">
            <iframe
              title="Live stream"
              src={s.embedUrl}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        )}
        {isAdmin && (
          <button type="button" className="text-sm text-amber-400/80 hover:underline mt-3" onClick={load}>
            Refresh status
          </button>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toLiveEmbedUrl } from '@/lib/live-stream-embed';

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
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const canStart =
    isAdmin && Boolean(urlInput.trim()) && toLiveEmbedUrl(urlInput.trim()) != null;
  const isLive = s.active && s.embedUrl;

  return (
    <div className="max-w-4xl">
      {isAdmin && (
        <div className="card mb-6 border-amber-500/30">
          <h3 className="text-lg font-semibold text-amber-200 mb-2">Start the stream for everyone</h3>
          <p className="text-slate-400 text-sm mb-4">
            Go live on <strong className="text-slate-300">YouTube</strong> or <strong className="text-slate-300">Vimeo</strong> in
            your studio, then paste the watch or live page URL here and press <strong className="text-amber-200/90">Start stream</strong>.
            That turns on the player on this page and the public page so anyone can watch — no app login on the public link.
          </p>
          {isLive ? (
            <p
              className="mb-4 rounded-lg border border-emerald-500/50 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200"
              role="status"
            >
              <span className="font-semibold">Live now</span> — fans can use the link below. Press Stop when the broadcast ends.
            </p>
          ) : (
            <p className="mb-4 text-sm text-slate-500" role="status">
              Stream is <span className="text-slate-300">off</span> for viewers until you start it here.
            </p>
          )}
          {err ? (
            <p className="text-red-400 text-sm mb-3" role="alert">
              {err}
            </p>
          ) : null}
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">YouTube or Vimeo stream URL</label>
              <input
                className="input-field w-full"
                placeholder="https://www.youtube.com/watch?v=… or https://vimeo.com/…"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Label (optional, shown to viewers)</label>
              <input
                className="input-field w-full"
                placeholder="e.g. vs Strikers — T20"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:items-center pt-1">
              <button
                type="button"
                className="btn-primary order-1"
                disabled={saving || !canStart || s.active}
                onClick={() =>
                  save({
                    url: urlInput.trim() || null,
                    title: titleInput.trim() || null,
                    active: true,
                  })
                }
              >
                {saving ? '…' : 'Start stream'}
              </button>
              <button
                type="button"
                className="order-2 rounded-lg border border-red-500/60 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-950/60 disabled:opacity-40"
                disabled={saving || !s.active}
                onClick={() => save({ active: false })}
              >
                {saving ? '…' : 'Stop stream'}
              </button>
              {s.active ? (
                <button
                  type="button"
                  className="order-3 text-sm text-amber-400/90 hover:underline"
                  disabled={saving}
                  onClick={() =>
                    save({
                      url: urlInput.trim() || null,
                      title: titleInput.trim() || null,
                      active: true,
                    })
                  }
                >
                  {saving ? '…' : 'Update URL / label (stay live)'}
                </button>
              ) : null}
            </div>
            {!canStart && urlInput.trim() ? (
              <p className="text-amber-200/80 text-xs">Use a full YouTube watch or Vimeo video URL we can embed.</p>
            ) : null}
          </div>
          <p className="text-slate-500 text-xs mt-4 break-all">
            <span className="text-slate-400">Public watch link (share anywhere):</span>{' '}
            <span className="text-amber-400/90">{publicLink}</span>
          </p>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-1">Current broadcast</h3>
        {s.title ? <p className="text-amber-200/90 text-sm mb-3">{s.title}</p> : null}
        {!s.active || !s.embedUrl ? (
          <p className="text-slate-400">
            {isAdmin ? (
              <>
                The player stays hidden until you press <span className="text-slate-300">Start stream</span> above. Then it also
                shows on the public link.
              </>
            ) : (
              <>The team has not started the live stream yet. Check back soon.</>
            )}
          </p>
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

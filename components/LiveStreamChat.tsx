'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';

type Msg = { id: string; author_name: string; body: string; created_at: string };

export default function LiveStreamChat({
  canPost,
  publicWatchHref,
}: {
  canPost: boolean;
  /** Path for share/copy, e.g. `/watch`. */
  publicWatchHref?: string;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [postErr, setPostErr] = useState('');
  const [copyFlash, setCopyFlash] = useState(false);

  const path = publicWatchHref?.trim().startsWith('/') ? publicWatchHref.trim() : '/watch';

  const load = useCallback(() => {
    fetch('/api/live-stream-chat', { credentials: canPost ? 'same-origin' : 'omit', cache: 'no-store' })
      .then(async (r) => {
        const d = (await r.json()) as { messages?: Msg[]; error?: string };
        if (!r.ok) {
          setLoadError(d.error || 'Could not load chat');
          return;
        }
        setMsgs(Array.isArray(d.messages) ? d.messages : []);
        setLoadError('');
      })
      .catch(() => setLoadError('Could not load chat'))
      .finally(() => {});
  }, [canPost]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 14000);
    return () => clearInterval(id);
  }, [load]);

  async function send() {
    const t = draft.trim();
    if (!t || sending) return;
    setSending(true);
    setPostErr('');
    try {
      const res = await fetch('/api/live-stream-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ body: t }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof d?.error === 'string' ? d.error : 'Send failed');
      setDraft('');
      load();
    } catch (e) {
      setPostErr(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  function watchUrlFull() {
    return `${window.location.origin}${path}`;
  }

  async function shareNative() {
    const url = watchUrlFull();
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Pirates — Live', url, text: 'Watch the stream' });
        return;
      } catch {
        /* user cancelled share sheet — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  }

  async function copyShareLinkOnly() {
    try {
      await navigator.clipboard.writeText(watchUrlFull());
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 2000);
    } catch {
      window.prompt('Copy this link:', watchUrlFull());
    }
  }

  return (
    <section className="rounded-lg border border-slate-600/70 bg-slate-900/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-amber-200">Team chatter</h3>
          <p className="text-slate-500 text-xs mt-0.5 max-w-xl">
            Quick reactions here stay in Pirates only — they don’t post to YouTube live chat or comments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void shareNative()}
            className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-100 hover:bg-amber-500/15"
          >
            Share watch link
          </button>
          <button
            type="button"
            onClick={() => void copyShareLinkOnly()}
            className="rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
          >
            {copyFlash ? 'Copied' : 'Copy link'}
          </button>
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 max-h-56 overflow-y-auto rounded-md border border-slate-700/80 bg-black/25 px-2 py-2 space-y-2">
        {loadError ? (
          <p className="text-amber-200/90 text-xs p-2" role="status">
            {loadError}
          </p>
        ) : msgs.length === 0 ? (
          <p className="text-slate-500 text-sm px-2 py-4 text-center">No messages yet.</p>
        ) : (
          msgs.map((m) => (
            <div key={m.id} className="rounded-md bg-slate-800/60 px-2.5 py-1.5 text-sm border border-slate-700/50">
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mb-0.5">
                <span className="text-amber-200/85 font-medium">{m.author_name}</span>
                <span>{format(new Date(m.created_at), 'h:mm a')}</span>
              </div>
              <p className="text-slate-100 whitespace-pre-wrap break-words">{m.body}</p>
            </div>
          ))
        )}
      </div>

      {canPost ? (
        <div className="space-y-2">
          {postErr ? (
            <p className="text-red-400 text-sm" role="alert">
              {postErr}
            </p>
          ) : null}
          <textarea
            className="input-field w-full min-h-[4rem] text-sm resize-y"
            placeholder="Say something… (visible to teammates on /live & public /watch)"
            maxLength={500}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 500))}
          />
          <div className="flex justify-between items-center gap-2">
            <span className="text-slate-500 text-xs">{draft.length}/500</span>
            <button
              type="button"
              className="btn-primary disabled:opacity-40"
              disabled={sending || !draft.trim()}
              onClick={() => void send()}
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-slate-500 text-sm">
          Open Pirates and sign in, then visit <strong className="text-slate-400">Live Stream</strong> to post —
          viewers here can still read along.
        </p>
      )}
    </section>
  );
}

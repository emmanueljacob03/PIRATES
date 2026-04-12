'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { TeamChatMessage } from '@/types/database';
import { format } from 'date-fns';
import { compressImageForUpload } from '@/lib/image-compress';
import { chatNameColorForUser } from '@/lib/chat-name-color';
import { parseChatBody, formatPollBody, formatImageBody } from '@/lib/chat-parse';
import { CHAT_STICKER_PACKS } from '@/lib/chat-stickers';
import TeamChatPollBlock from '@/components/TeamChatPollBlock';

/** Manual Database shape lacks full GenericSchema; PostgREST insert types resolve to `never` without this. */
const db = supabase as unknown as SupabaseClient<any>;

type Row = TeamChatMessage;

const EDIT_WINDOW_MS = 20 * 60 * 1000;

function bumpMessageAnimation(
  setAnimIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  id: string,
) {
  setAnimIds((s) => new Set(s).add(id));
  window.setTimeout(() => {
    setAnimIds((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  }, 500);
}

export default function TeamChatClient({
  initialMessages,
  userId,
  senderName,
  viewerAvatarUrl,
  isAdmin,
  isDemo,
}: {
  initialMessages: Row[];
  userId: string | null;
  senderName: string;
  /** Logged-in user profile photo (header + hint). */
  viewerAvatarUrl?: string | null;
  isAdmin: boolean;
  isDemo: boolean;
}) {
  const [messages, setMessages] = useState<Row[]>(initialMessages);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [postAsAlert, setPostAsAlert] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, setTimeTick] = useState(0);
  const [animIds, setAnimIds] = useState<Set<string>>(new Set());
  const [attachOpen, setAttachOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState(['', '']);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const attachWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    const id = window.setInterval(() => setTimeTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (attachWrapRef.current && !attachWrapRef.current.contains(e.target as Node)) setAttachOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    if (isDemo || !userId) return;
    const channel = db
      .channel('team-chat-messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_chat_messages' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Row;
            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              queueMicrotask(() => bumpMessageAnimation(setAnimIds, row.id));
              return [...prev, row];
            });
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as Row;
            setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id?: string };
            const id = oldRow?.id;
            if (id) setMessages((prev) => prev.filter((m) => m.id !== id));
          }
        },
      )
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [isDemo, userId]);

  const canPost = !!userId && !isDemo;

  function canModify(m: Row): boolean {
    if (!userId || isDemo) return false;
    if (isAdmin) return true;
    if (m.user_id !== userId) return false;
    return Date.now() - new Date(m.created_at).getTime() <= EDIT_WINDOW_MS;
  }

  async function postBody(body: string, isAlert = false) {
    const trimmed = body.trim();
    if (!trimmed || !canPost) return;
    setSending(true);
    setError('');
    const tempId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `temp-${crypto.randomUUID()}`
        : `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Row = {
      id: tempId,
      user_id: userId!,
      sender_name: senderName,
      body: trimmed,
      is_alert: isAlert,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    bumpMessageAnimation(setAnimIds, tempId);
    setText('');
    setPostAsAlert(false);
    setStickerOpen(false);
    setAttachOpen(false);

    try {
      const res = await fetch('/api/team-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          body: trimmed,
          sender_name: senderName,
          is_alert: isAlert,
        }),
      });
      const json = (await res.json()) as { data?: TeamChatMessage; error?: string };

      if (!res.ok) {
        setError(json.error || 'Could not send message');
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return;
      }
      if (json.data) {
        const inserted = json.data as TeamChatMessage;
        setMessages((prev) => {
          const without = prev.filter((m) => m.id !== tempId && m.id !== inserted.id);
          return [...without, inserted];
        });
        bumpMessageAnimation(setAnimIds, inserted.id);
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
      inputRef.current?.focus();
    } catch {
      setError('Network error — try again');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  }

  async function send() {
    await postBody(text, isAdmin && postAsAlert);
  }

  async function uploadAndSendImage(file: File | null) {
    if (!file || !userId || !canPost) return;
    setAttachOpen(false);
    setError('');
    try {
      const compressed = await compressImageForUpload(file, { maxEdge: 1600, maxBytes: 1_400_000 });
      const path = `team-chat/${userId}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, compressed, {
        upsert: false,
        contentType: compressed.type || 'image/jpeg',
      });
      if (upErr) {
        setError(upErr.message);
        return;
      }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = pub.publicUrl;
      await postBody(formatImageBody(url, ''), false);
    } catch {
      setError('Could not upload image');
    }
  }

  function startPollFromModal() {
    const q = pollQ.trim();
    const opts = pollOpts.map((o) => o.trim()).filter(Boolean);
    if (q.length < 1 || opts.length < 2) {
      setError('Poll needs a question and at least two options.');
      return;
    }
    setPollOpen(false);
    setPollQ('');
    setPollOpts(['', '']);
    void postBody(formatPollBody(q, opts), false);
  }

  function startEdit(m: Row) {
    setEditingId(m.id);
    setEditText(m.body);
    setError('');
    queueMicrotask(() => editInputRef.current?.focus());
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText('');
  }

  async function saveEdit() {
    const id = editingId;
    const body = editText.trim();
    if (!id || !body || !canPost) return;
    const editedRow = messages.find((m) => m.id === id);
    const nameForUpdate =
      editedRow && isAdmin && editedRow.user_id !== userId ? editedRow.sender_name : senderName;

    setSavingEdit(true);
    setError('');
    try {
      const res = await fetch('/api/team-chat', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id, body, sender_name: nameForUpdate }),
      });
      const json = (await res.json()) as { data?: Row; error?: string };

      if (!res.ok) {
        setError(json.error || 'Could not update message');
        return;
      }
      if (json.data) {
        const row = json.data;
        setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
      }
      cancelEdit();
    } catch {
      setError('Network error — try again');
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeMessage(id: string) {
    if (!canPost || !window.confirm('Delete this message for everyone?')) return;
    setDeletingId(id);
    setError('');
    try {
      const res = await fetch(`/api/team-chat?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok) {
        setError(json.error || 'Could not delete message');
        return;
      }
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (editingId === id) cancelEdit();
    } catch {
      setError('Network error — try again');
    } finally {
      setDeletingId(null);
    }
  }

  const sorted = useMemo(() => [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at)), [messages]);

  if (isDemo || !userId) {
    return (
      <div className="rounded-2xl border border-slate-600 bg-slate-800/50 p-10 text-center text-slate-300 max-w-5xl mx-auto min-h-[50vh] flex flex-col items-center justify-center">
        <p className="text-lg font-semibold text-emerald-400 mb-2 font-['Times_New_Roman',Times,serif] tracking-wide uppercase">
          PIRATES CHAT
        </p>
        <p className="text-sm max-w-md">Sign in (not demo mode) to open chat.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-2xl border border-slate-700 overflow-hidden bg-slate-900/80 shadow-xl w-full max-w-5xl mx-auto h-[min(88vh,920px)]">
      <div
        className="flex-shrink-0 px-4 py-3 flex items-center gap-3 border-b border-slate-800"
        style={{ background: 'linear-gradient(180deg, #1f2c34 0%, #111b21 100%)' }}
      >
        <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-lg font-bold text-white">
          P
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[var(--pirate-yellow)] font-semibold text-lg tracking-[0.12em] uppercase font-['Times_New_Roman',Times,serif]">
            PIRATES CHAT
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
            <Link
              href="/profiles"
              className="text-[11px] text-slate-400 hover:text-amber-300/90 underline underline-offset-2"
            >
              Profile photo → set your DP from device
            </Link>
          </div>
        </div>
        <Link href="/profiles" className="shrink-0 relative w-11 h-11 rounded-full overflow-hidden border border-slate-600 bg-slate-800">
          {viewerAvatarUrl ? (
            <Image src={viewerAvatarUrl} alt="" fill className="object-cover" sizes="44px" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs">+</span>
          )}
        </Link>
      </div>

      <div
        className="flex-1 overflow-y-auto px-3 py-4 space-y-2 chat-scroll"
        style={{
          backgroundColor: '#0b141a',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231a2428' fill-opacity='0.35'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {sorted.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-12">No messages yet. Start the conversation.</p>
        ) : (
          sorted.map((m) => {
            const mine = m.user_id === userId;
            const alert = m.is_alert;
            const isEditing = editingId === m.id;
            const parsed = parseChatBody(m.body);
            const nameColor = chatNameColorForUser(m.user_id);
            const enterClass = animIds.has(m.id) ? 'chat-msg-in' : '';

            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} ${enterClass}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 shadow-md group relative ${
                    alert
                      ? 'border-2 border-red-500 bg-red-950/90 text-red-50'
                      : mine
                        ? 'bg-[#005c4b] text-slate-100 rounded-br-sm'
                        : 'bg-[#202c33] text-slate-100 rounded-bl-sm border border-slate-700/60'
                  }`}
                >
                  {canModify(m) && !isEditing && (
                    <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-[5]">
                      <button
                        type="button"
                        onClick={() => startEdit(m)}
                        disabled={!!deletingId}
                        className="p-1 rounded-md bg-slate-900/85 text-slate-200 hover:text-white border border-slate-600"
                        title="Edit"
                        aria-label="Edit message"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeMessage(m.id)}
                        disabled={deletingId === m.id}
                        className="p-1 rounded-md bg-slate-900/85 text-red-300 hover:text-red-100 border border-red-900/60"
                        title="Delete"
                        aria-label="Delete message"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {alert && (
                    <div className="text-[10px] font-bold uppercase tracking-wider text-red-300 mb-1 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                      Admin alert
                    </div>
                  )}
                  <p
                    className={`text-xs font-semibold mb-0.5 ${alert ? 'text-red-200' : ''}`}
                    style={alert ? undefined : { color: nameColor }}
                  >
                    {m.sender_name}
                    {mine ? ' · you' : ''}
                  </p>
                  {isEditing ? (
                    <div className="space-y-2 mt-1" onClick={(e) => e.stopPropagation()}>
                      <textarea
                        ref={editInputRef}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        maxLength={4000}
                        className="w-full rounded-md bg-[#0b141a] border border-slate-600 text-slate-100 text-sm p-2 outline-none focus:ring-2 focus:ring-emerald-600/50"
                        disabled={savingEdit}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={savingEdit}
                          className="text-xs px-3 py-1.5 rounded-full bg-slate-700 text-slate-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveEdit()}
                          disabled={savingEdit || !editText.trim()}
                          className="text-xs px-3 py-1.5 rounded-full bg-emerald-600 text-white disabled:opacity-40"
                        >
                          {savingEdit ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : parsed.kind === 'image' ? (
                    <div className="space-y-1.5">
                      <div className="relative rounded-md overflow-hidden max-w-[min(100%,280px)] border border-slate-700/80">
                        <Image
                          src={parsed.url}
                          alt={parsed.alt}
                          width={280}
                          height={200}
                          className="w-full h-auto object-cover"
                          unoptimized
                        />
                      </div>
                      {parsed.caption ? (
                        <p className="text-[0.9375rem] whitespace-pre-wrap break-words leading-snug">{parsed.caption}</p>
                      ) : null}
                    </div>
                  ) : parsed.kind === 'poll' ? (
                    <TeamChatPollBlock messageId={m.id} parsed={parsed} userId={userId} />
                  ) : (
                    <p className="text-[0.9375rem] whitespace-pre-wrap break-words leading-snug">{m.body}</p>
                  )}
                  {!isEditing && (
                    <p className={`text-[10px] mt-1 tabular-nums ${alert ? 'text-red-300/80' : 'text-slate-400'}`}>
                      {format(new Date(m.created_at), 'HH:mm')}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="flex-shrink-0 border-t border-slate-800 relative" style={{ background: '#1f2c34' }}>
        {error && <p className="text-xs text-red-400 px-3 pt-2">{error}</p>}
        {isAdmin && (
          <label className="absolute top-2 right-3 z-10 flex items-center gap-2 cursor-pointer select-none rounded-md bg-[#111b21]/90 border border-slate-600/80 px-2 py-1">
            <input
              type="checkbox"
              checked={postAsAlert}
              onChange={(e) => setPostAsAlert(e.target.checked)}
              className="rounded border-slate-500 text-red-600 focus:ring-red-500 shrink-0"
            />
            <span className={`text-xs font-medium ${postAsAlert ? 'text-red-400' : 'text-slate-400'}`}>Alert</span>
          </label>
        )}

        {stickerOpen && (
          <div className="absolute bottom-full left-0 right-0 z-40 mb-1 mx-2 max-h-56 overflow-y-auto rounded-xl border border-slate-600 bg-[#111b21] p-3 shadow-xl">
            {CHAT_STICKER_PACKS.map((pack) => (
              <div key={pack.title} className="mb-3 last:mb-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">{pack.title}</p>
                <div className="flex flex-wrap gap-2">
                  {pack.items.map((s) => (
                    <button
                      key={`${pack.title}-${s.label}`}
                      type="button"
                      className="text-2xl p-2 rounded-lg hover:bg-slate-700/80 border border-transparent hover:border-slate-600"
                      title={s.label}
                      onClick={() => {
                        void postBody(`${s.emoji} ${s.label}`, false);
                      }}
                    >
                      {s.emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {pollOpen && (
          <div className="absolute bottom-full left-2 right-2 z-40 mb-1 p-3 rounded-xl border border-amber-500/40 bg-[#0b141a] shadow-xl max-h-[70vh] overflow-y-auto">
            <p className="text-sm text-slate-200 font-medium mb-2">New poll</p>
            <input
              className="w-full rounded-lg bg-[#2a3942] border border-slate-600 text-slate-100 text-sm px-3 py-2 mb-2"
              placeholder="Question"
              value={pollQ}
              onChange={(e) => setPollQ(e.target.value)}
            />
            {pollOpts.map((o, i) => (
              <input
                key={i}
                className="w-full rounded-lg bg-[#2a3942] border border-slate-600 text-slate-100 text-sm px-3 py-2 mb-2"
                placeholder={`Option ${i + 1}`}
                value={o}
                onChange={(e) => {
                  const next = [...pollOpts];
                  next[i] = e.target.value;
                  setPollOpts(next);
                }}
              />
            ))}
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="text-xs text-amber-400 hover:underline"
                onClick={() => setPollOpts((p) => [...p, ''])}
              >
                + Add option
              </button>
            </div>
            <div className="flex gap-2 justify-end mt-3">
              <button type="button" className="text-sm px-3 py-1.5 rounded-full bg-slate-700 text-slate-200" onClick={() => setPollOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="text-sm px-3 py-1.5 rounded-full bg-emerald-600 text-white"
                onClick={() => startPollFromModal()}
              >
                Send poll
              </button>
            </div>
          </div>
        )}

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            void uploadAndSendImage(f ?? null);
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            void uploadAndSendImage(f ?? null);
          }}
        />

        <div className={`flex items-end gap-1 p-2 ${isAdmin ? 'pt-9' : ''}`}>
          <div className="relative shrink-0" ref={attachWrapRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAttachOpen((o) => !o);
                setStickerOpen(false);
              }}
              className="w-11 h-11 rounded-full flex items-center justify-center text-slate-200 hover:bg-slate-700/80 border border-slate-600/80 text-2xl font-light leading-none"
              aria-label="Attach"
              disabled={!canPost || sending}
            >
              +
            </button>
            {attachOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-48 rounded-xl border border-slate-600 bg-[#111b21] shadow-xl py-1 z-50">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-700/80"
                  onClick={() => {
                    cameraInputRef.current?.click();
                  }}
                >
                  <span className="mr-2">📷</span> Camera
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-700/80"
                  onClick={() => {
                    galleryInputRef.current?.click();
                  }}
                >
                  <span className="mr-2">🖼</span> Photo
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-700/80"
                  onClick={() => {
                    setAttachOpen(false);
                    setPollOpen(true);
                  }}
                >
                  <span className="mr-2">📊</span> Poll
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-700/80"
                  onClick={() => {
                    setAttachOpen(false);
                    setStickerOpen((s) => !s);
                  }}
                >
                  <span className="mr-2">😂</span> Stickers
                </button>
              </div>
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Type a message"
            maxLength={4000}
            disabled={!canPost || sending}
            className="flex-1 rounded-full bg-[#2a3942] border border-slate-600/80 text-slate-100 placeholder:text-slate-500 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-600/50"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!canPost || sending || !text.trim()}
            className="rounded-full p-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white shadow-lg shrink-0"
            aria-label="Send"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

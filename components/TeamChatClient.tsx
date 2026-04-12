'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { TeamChatMessage } from '@/types/database';
import { format } from 'date-fns';
import { compressImageForUpload } from '@/lib/image-compress';
import { chatNameColorForUser } from '@/lib/chat-name-color';
import { parseChatBody, formatPollBody, formatImageBody, SYS_ROOM_ICON_BODY } from '@/lib/chat-parse';
import { CHAT_EMOJI_GRID } from '@/lib/chat-emojis';
import { chatImageUrlsForUser } from '@/lib/chat-user-images';
import TeamChatPollBlock from '@/components/TeamChatPollBlock';

const DEFAULT_TEAM_CHAT_IMAGE = '/pirates-emblem.png';

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
  roomHeaderImageUrl,
  isAdmin,
  isDemo,
}: {
  initialMessages: Row[];
  userId: string | null;
  senderName: string;
  /** Team chat room header (not profile); null → Pirates emblem. */
  roomHeaderImageUrl: string | null;
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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [roomHeaderUrl, setRoomHeaderUrl] = useState<string | null>(roomHeaderImageUrl ?? null);
  const [roomImageModalOpen, setRoomImageModalOpen] = useState(false);
  const [roomUploading, setRoomUploading] = useState(false);
  const [userGallery, setUserGallery] = useState<{ userId: string; name: string } | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState(['', '']);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const roomCameraInputRef = useRef<HTMLInputElement>(null);
  const roomGalleryInputRef = useRef<HTMLInputElement>(null);
  const attachWrapRef = useRef<HTMLDivElement>(null);
  const emojiBtnWrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    const id = window.setInterval(() => setTimeTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setRoomHeaderUrl(roomHeaderImageUrl ?? null);
  }, [roomHeaderImageUrl]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (attachWrapRef.current && !attachWrapRef.current.contains(e.target as Node)) setAttachOpen(false);
      if (emojiBtnWrapRef.current && !emojiBtnWrapRef.current.contains(e.target as Node)) setEmojiOpen(false);
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

  useEffect(() => {
    if (isDemo || !userId) return;
    const ch = db
      .channel('team-chat-settings')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'team_chat_settings' },
        (payload) => {
          const row = payload.new as { header_image_url?: string | null };
          if (row?.header_image_url !== undefined) setRoomHeaderUrl(row.header_image_url ?? null);
        },
      )
      .subscribe();
    return () => {
      db.removeChannel(ch);
    };
  }, [isDemo, userId]);

  const canPost = !!userId && !isDemo;

  async function uploadRoomHeaderImage(file: File | null) {
    if (!file || !userId) return;
    setRoomUploading(true);
    setError('');
    try {
      const compressed = await compressImageForUpload(file, { maxBytes: 2_400_000, maxEdge: 2000 });
      const ext = compressed.name.split('.').pop() || 'jpg';
      const path = `team-chat/room/header-${Date.now()}.${ext}`;
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
      const { error: setErr } = await (supabase as any)
        .from('team_chat_settings')
        .upsert(
          { id: 1, header_image_url: url, updated_at: new Date().toISOString() },
          { onConflict: 'id' },
        );
      if (setErr) {
        setError(
          setErr.message.includes('team_chat_settings') || setErr.code === '42P01'
            ? 'Run supabase/team_chat_settings.sql in the Supabase SQL editor (include INSERT policy) to enable the team chat image.'
            : setErr.message,
        );
        return;
      }
      setRoomHeaderUrl(url);
      router.refresh();
      await postBody(SYS_ROOM_ICON_BODY, false, { skipSendingState: true });
    } catch {
      setError('Could not update team chat image');
    } finally {
      setRoomUploading(false);
    }
  }

  function canModify(m: Row): boolean {
    if (parseChatBody(m.body).kind === 'system') return false;
    if (!userId || isDemo) return false;
    if (isAdmin) return true;
    if (m.user_id !== userId) return false;
    return Date.now() - new Date(m.created_at).getTime() <= EDIT_WINDOW_MS;
  }

  async function postBody(body: string, isAlert = false, opts?: { skipSendingState?: boolean }) {
    const trimmed = body.trim();
    if (!trimmed || !canPost) return;
    const skipSending = opts?.skipSendingState ?? false;
    if (!skipSending) setSending(true);
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
    if (!skipSending) {
      setText('');
      setPostAsAlert(false);
      setEmojiOpen(false);
      setAttachOpen(false);
    }

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
      if (!skipSending) inputRef.current?.focus();
    } catch {
      setError('Network error — try again');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      if (!skipSending) setSending(false);
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

  const userGalleryUrls = useMemo(() => {
    if (!userGallery) return [];
    return chatImageUrlsForUser(messages, userGallery.userId);
  }, [messages, userGallery]);

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
    <>
    <div className="flex flex-col rounded-2xl border border-slate-700 overflow-hidden bg-slate-900/80 shadow-xl w-full max-w-3xl mx-auto h-[min(88vh,920px)]">
      <input
        ref={roomCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          void uploadRoomHeaderImage(f ?? null);
        }}
      />
      <input
        ref={roomGalleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          void uploadRoomHeaderImage(f ?? null);
        }}
      />
      <div
        className="flex-shrink-0 px-4 py-3 flex items-center gap-3 border-b border-slate-800"
        style={{ background: 'linear-gradient(180deg, #1f2c34 0%, #111b21 100%)' }}
      >
        <button
          type="button"
          onClick={() => setRoomImageModalOpen(true)}
          className="relative shrink-0 w-10 h-10 rounded-full overflow-hidden border-2 border-amber-400/70 shadow-[0_0_14px_rgba(251,191,36,0.45)] ring-1 ring-amber-500/50 hover:ring-amber-300/80 focus:outline-none focus:ring-2 focus:ring-amber-400"
          title="Team chat image — tap to view or change"
          aria-label="Team chat image"
        >
          <Image
            src={roomHeaderUrl || DEFAULT_TEAM_CHAT_IMAGE}
            alt="Pirates team chat"
            fill
            className="object-cover"
            sizes="40px"
            unoptimized={!!roomHeaderUrl && roomHeaderUrl.startsWith('http')}
          />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[var(--pirate-yellow)] font-semibold text-lg tracking-[0.12em] uppercase font-['Times_New_Roman',Times,serif]">
            PIRATES CHAT
          </h1>
        </div>
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

            if (parsed.kind === 'system' && parsed.systemKind === 'room_icon') {
              return (
                <div key={m.id} className={`flex justify-center my-2 ${enterClass}`}>
                  <p className="text-center text-[11px] leading-snug text-slate-500 px-3 py-1.5 rounded-full bg-[#111b21]/90 border border-slate-700/60 max-w-[min(100%,22rem)]">
                    {mine ? (
                      <>You changed the team chat picture</>
                    ) : (
                      <>
                        <span className="font-semibold" style={{ color: nameColor }}>
                          {m.sender_name}
                        </span>
                        <span className="text-slate-500"> changed the team chat picture</span>
                      </>
                    )}
                    <span className="text-slate-600 tabular-nums"> · {format(new Date(m.created_at), 'HH:mm')}</span>
                  </p>
                </div>
              );
            }

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
                  <button
                    type="button"
                    className={`text-xs font-semibold mb-0.5 w-full text-left bg-transparent border-0 p-0 cursor-pointer hover:underline ${alert ? 'text-red-200' : ''}`}
                    style={alert ? undefined : { color: nameColor }}
                    onClick={() => setUserGallery({ userId: m.user_id, name: m.sender_name })}
                  >
                    {m.sender_name}
                    {mine ? ' · you' : ''}
                  </button>
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
          <div className="flex justify-end px-3 pt-2 pb-1">
            <label className="flex items-center gap-2 cursor-pointer select-none rounded-md bg-[#111b21]/90 border border-slate-600/80 px-2 py-1">
              <input
                type="checkbox"
                checked={postAsAlert}
                onChange={(e) => setPostAsAlert(e.target.checked)}
                className="rounded border-slate-500 text-red-600 focus:ring-red-500 shrink-0"
              />
              <span className={`text-xs font-medium ${postAsAlert ? 'text-red-400' : 'text-slate-400'}`}>Alert</span>
            </label>
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

        <div className={`flex items-end gap-1 p-2 ${isAdmin ? 'pt-1' : ''}`}>
          <div className="relative shrink-0" ref={attachWrapRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAttachOpen((o) => !o);
                setEmojiOpen(false);
              }}
              className="w-11 h-11 rounded-full flex items-center justify-center text-slate-200 hover:bg-slate-700/80 border border-slate-600/80"
              aria-label="Attach"
              disabled={!canPost || sending}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
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
                  Camera
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-700/80"
                  onClick={() => {
                    galleryInputRef.current?.click();
                  }}
                >
                  Photo
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-700/80"
                  onClick={() => {
                    setAttachOpen(false);
                    setPollOpen(true);
                  }}
                >
                  Poll
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
            className="flex-1 rounded-full bg-[#2a3942] border border-slate-600/80 text-slate-100 placeholder:text-slate-500 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-600/50 min-w-0"
          />

          <div className="relative shrink-0" ref={emojiBtnWrapRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEmojiOpen((o) => !o);
                setAttachOpen(false);
              }}
              className="w-11 h-11 rounded-full flex items-center justify-center text-xl leading-none text-slate-200 hover:bg-slate-700/80 border border-slate-600/80"
              aria-label="Emojis"
              aria-expanded={emojiOpen}
              disabled={!canPost || sending}
            >
              😀
            </button>
            {emojiOpen && (
              <div className="absolute bottom-full right-0 mb-2 z-50 w-[min(92vw,280px)] max-h-64 overflow-y-auto rounded-xl border border-slate-600 bg-[#111b21] p-3 shadow-xl">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Emojis</p>
                <div className="flex flex-wrap gap-1">
                  {CHAT_EMOJI_GRID.map((em, i) => (
                    <button
                      key={`${em}-${i}`}
                      type="button"
                      className="text-2xl p-1.5 rounded-md hover:bg-slate-700/80 border border-transparent hover:border-slate-600 leading-none"
                      onClick={() => {
                        void postBody(em, false);
                      }}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

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

    {roomImageModalOpen && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Team chat image"
        onClick={() => setRoomImageModalOpen(false)}
      >
        <div
          className="relative flex w-full max-w-md flex-col items-center gap-5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setRoomImageModalOpen(false)}
            className="absolute -top-1 -right-1 z-10 rounded-full bg-slate-800/90 border border-slate-600 text-slate-200 w-9 h-9 text-lg leading-none hover:bg-slate-700"
            aria-label="Close"
          >
            ×
          </button>
          <div className="relative w-full max-h-[min(70vh,420px)] aspect-square rounded-2xl overflow-hidden border-4 border-amber-400 shadow-[0_0_28px_rgba(251,191,36,0.55),0_0_56px_rgba(251,191,36,0.25)] bg-[#0b141a]">
            <Image
              src={roomHeaderUrl || DEFAULT_TEAM_CHAT_IMAGE}
              alt="Team chat"
              fill
              className="object-contain p-1"
              sizes="(max-width:768px) 92vw, 420px"
              unoptimized={!!roomHeaderUrl && roomHeaderUrl.startsWith('http')}
            />
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              disabled={!canPost || roomUploading}
              onClick={() => roomCameraInputRef.current?.click()}
              className="rounded-full px-5 py-2.5 text-sm font-medium bg-slate-700 text-slate-100 border border-slate-600 hover:bg-slate-600 disabled:opacity-50"
            >
              Camera
            </button>
            <button
              type="button"
              disabled={!canPost || roomUploading}
              onClick={() => roomGalleryInputRef.current?.click()}
              className="rounded-full px-5 py-2.5 text-sm font-medium bg-slate-700 text-slate-100 border border-slate-600 hover:bg-slate-600 disabled:opacity-50"
            >
              Photo
            </button>
            {roomUploading ? <span className="text-sm text-amber-200/90 self-center">Updating…</span> : null}
          </div>
        </div>
      </div>
    )}

    {userGallery && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label={`Photos from ${userGallery.name}`}
        onClick={() => setUserGallery(null)}
      >
        <div
          className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-600 bg-[#111b21] p-4 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-[var(--pirate-yellow)] font-semibold font-['Times_New_Roman',Times,serif] tracking-wide">
              {userGallery.name}&apos;s chat photos
            </h2>
            <button
              type="button"
              onClick={() => setUserGallery(null)}
              className="rounded-full bg-slate-800 border border-slate-600 text-slate-200 w-9 h-9 text-lg leading-none hover:bg-slate-700 shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          {userGalleryUrls.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No photos shared in chat yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {userGalleryUrls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative aspect-square rounded-lg overflow-hidden border border-slate-600/80 bg-[#0b141a] focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                >
                  <Image src={url} alt="" fill className="object-cover" sizes="(max-width:640px) 45vw, 160px" unoptimized />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
}

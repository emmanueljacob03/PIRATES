'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { TeamChatMessage, TeamChatMessageInsert } from '@/types/database';
import { format } from 'date-fns';

/** Manual Database shape lacks full GenericSchema; PostgREST insert types resolve to `never` without this. */
const db = supabase as unknown as SupabaseClient<any>;

type Row = TeamChatMessage;

export default function TeamChatClient({
  initialMessages,
  userId,
  senderName,
  isAdmin,
  isDemo,
}: {
  initialMessages: Row[];
  userId: string | null;
  senderName: string;
  isAdmin: boolean;
  isDemo: boolean;
}) {
  const [messages, setMessages] = useState<Row[]>(initialMessages);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  /** Admins: checked = send next message as red alert. */
  const [postAsAlert, setPostAsAlert] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

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
            setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
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

  async function send() {
    const body = text.trim();
    if (!body || !canPost) return;
    setSending(true);
    setError('');
    const row: TeamChatMessageInsert = {
      user_id: userId,
      sender_name: senderName,
      body,
      is_alert: isAdmin && postAsAlert,
    };
    const { data, error: insErr } = await db.from('team_chat_messages').insert(row).select().single();

    setSending(false);
    if (insErr) {
      setError(
        insErr.message.includes('row-level security')
          ? 'Could not send (run team_chat_messages.sql in Supabase, or alerts require admin profile role).'
          : insErr.message,
      );
      return;
    }
    if (data) {
      const inserted = data as TeamChatMessage;
      setMessages((prev) => (prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]));
    }
    setText('');
    setPostAsAlert(false);
    inputRef.current?.focus();
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
    setSavingEdit(true);
    setError('');
    const { data, error: updErr } = await db
      .from('team_chat_messages')
      .update({ body, sender_name: senderName })
      .eq('id', id)
      .select()
      .single();
    setSavingEdit(false);
    if (updErr) {
      setError(
        updErr.message.includes('row-level security')
          ? 'Could not update (run the latest team_chat_messages.sql policies, or refresh and try again).'
          : updErr.message,
      );
      return;
    }
    if (data) {
      const row = data as Row;
      setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
    }
    cancelEdit();
  }

  async function removeMessage(id: string) {
    if (!canPost || !window.confirm('Delete this message for everyone?')) return;
    setDeletingId(id);
    setError('');
    const { error: delErr } = await db.from('team_chat_messages').delete().eq('id', id);
    setDeletingId(null);
    if (delErr) {
      setError(
        delErr.message.includes('row-level security')
          ? 'Could not delete (you can only delete your own messages).'
          : delErr.message,
      );
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
    if (editingId === id) cancelEdit();
  }

  const sorted = useMemo(() => [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at)), [messages]);

  if (isDemo || !userId) {
    return (
      <div className="rounded-2xl border border-slate-600 bg-slate-800/50 p-10 text-center text-slate-300 max-w-5xl mx-auto min-h-[50vh] flex flex-col items-center justify-center">
        <p className="text-lg font-semibold text-emerald-400 mb-2">Pirates chat</p>
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
        <h1 className="text-emerald-400 font-semibold text-base tracking-tight">Pirates chat</h1>
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
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 shadow-md group relative ${
                    alert
                      ? 'border-2 border-red-500 bg-red-950/90 text-red-50'
                      : mine
                        ? 'bg-[#005c4b] text-slate-100 rounded-br-sm'
                        : 'bg-[#202c33] text-slate-100 rounded-bl-sm border border-slate-700/60'
                  }`}
                >
                  {mine && !isEditing && (
                    <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
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
                  <p className={`text-xs font-semibold mb-0.5 ${alert ? 'text-red-200' : 'text-emerald-400'}`}>
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
        <div className={`flex items-end gap-2 p-2 ${isAdmin ? 'pt-9' : ''}`}>
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

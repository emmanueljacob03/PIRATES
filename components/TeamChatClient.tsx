'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { TeamChatMessage, TeamChatMessageInsert } from '@/types/database';

/** Manual Database shape lacks full GenericSchema; PostgREST insert types resolve to `never` without this. */
const db = supabase as unknown as SupabaseClient<any>;
import { format } from 'date-fns';

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
  /** Admin: next message is urgent alert (red) when true */
  const [alertMode, setAlertMode] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (isDemo || !userId) return;
    const channel = db
      .channel('team-chat-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_chat_messages' },
        (payload) => {
          const row = payload.new as Row;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
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
    const isAlert = isAdmin && alertMode;
    const row: TeamChatMessageInsert = {
      user_id: userId,
      sender_name: senderName,
      body,
      is_alert: isAlert,
    };
    const { data, error: insErr } = await db.from('team_chat_messages').insert(row).select().single();

    setSending(false);
    if (insErr) {
      setError(
        insErr.message.includes('row-level security')
          ? 'Could not send (run team_chat_messages.sql in Supabase, or sign in as admin for alerts).'
          : insErr.message,
      );
      return;
    }
    if (data) {
      const inserted = data as TeamChatMessage;
      setMessages((prev) => (prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]));
    }
    setText('');
    setAlertMode(false);
    inputRef.current?.focus();
  }

  const sorted = useMemo(() => [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at)), [messages]);

  if (isDemo || !userId) {
    return (
      <div className="rounded-xl border border-slate-600 bg-slate-800/50 p-8 text-center text-slate-300">
        <p className="text-lg font-medium text-[var(--pirate-yellow)] mb-2">Team chat</p>
        <p className="text-sm max-w-md mx-auto">
          Sign in with your team account (not demo mode) to read and post in the squad chat. Ask an admin if you need
          access.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-2xl border border-slate-700 overflow-hidden bg-slate-900/80 shadow-xl max-w-3xl mx-auto h-[min(78vh,720px)]">
      {/* WhatsApp-inspired header */}
      <div
        className="flex-shrink-0 px-4 py-3 flex items-center gap-3 border-b border-slate-800"
        style={{ background: 'linear-gradient(180deg, #1f2c34 0%, #111b21 100%)' }}
      >
        <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center text-lg font-bold text-emerald-100">
          P
        </div>
        <div>
          <h1 className="text-slate-100 font-semibold text-sm">Pirates team chat</h1>
          <p className="text-xs text-emerald-400/90">Club squad · {sorted.length} message{sorted.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Pattern background message list */}
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
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 shadow-md ${
                    alert
                      ? 'border-2 border-red-500 bg-red-950/90 text-red-50'
                      : mine
                        ? 'bg-[#005c4b] text-slate-100 rounded-br-sm'
                        : 'bg-[#202c33] text-slate-100 rounded-bl-sm border border-slate-700/60'
                  }`}
                >
                  {alert && (
                    <div className="text-[10px] font-bold uppercase tracking-wider text-red-300 mb-1 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                      Admin alert
                    </div>
                  )}
                  {!mine && (
                    <p className={`text-xs font-semibold mb-0.5 ${alert ? 'text-red-200' : 'text-emerald-400'}`}>
                      {m.sender_name}
                    </p>
                  )}
                  <p className="text-[0.9375rem] whitespace-pre-wrap break-words leading-snug">{m.body}</p>
                  <p className={`text-[10px] mt-1 tabular-nums ${alert ? 'text-red-300/80' : 'text-slate-400'}`}>
                    {format(new Date(m.created_at), 'HH:mm')}
                    {mine ? ' · You' : ''}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Composer — WhatsApp-style bar */}
      <div
        className="flex-shrink-0 p-2 border-t border-slate-800 flex flex-col gap-2"
        style={{ background: '#1f2c34' }}
      >
        {error && <p className="text-xs text-red-400 px-2">{error}</p>}
        {isAdmin && (
          <div className="flex items-center gap-2 px-1 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-slate-500 w-full sm:w-auto">Post as:</span>
            <button
              type="button"
              onClick={() => setAlertMode(false)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                !alertMode ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => setAlertMode(true)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                alertMode ? 'bg-red-900/90 border-red-500 text-red-100' : 'border-red-700/50 text-red-400 hover:bg-red-950/50'
              }`}
            >
              Alert
            </button>
            {alertMode && (
              <span className="text-[10px] text-red-400">Next message sends as highlighted alert</span>
            )}
          </div>
        )}
        <div className="flex items-end gap-2">
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
            className="rounded-full p-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white shadow-lg"
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

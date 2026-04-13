'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ParsedChatBody } from '@/lib/chat-parse';
import { chatNameColorForUser } from '@/lib/chat-name-color';

type VoteRow = { message_id: string; user_id: string; option_index: number };

export default function TeamChatPollBlock({
  messageId,
  parsed,
  userId,
}: {
  messageId: string;
  parsed: Extract<ParsedChatBody, { kind: 'poll' }>;
  userId: string | null;
}) {
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [nameById, setNameById] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!messageId) return;
    setLoading(true);
    try {
      const { data: voteRows, error } = await supabase
        .from('team_chat_poll_votes')
        .select('*')
        .eq('message_id', messageId);
      if (error) {
        setVotes([]);
        setNameById(new Map());
        setErr('');
      } else {
        const rows = (voteRows ?? []) as VoteRow[];
        setVotes(rows);
        const ids = Array.from(new Set(rows.map((r) => r.user_id)));
        if (ids.length > 0) {
          const { data: profs } = await supabase.from('profiles').select('id, name').in('id', ids);
          const m = new Map<string, string>();
          for (const p of profs ?? []) {
            const row = p as { id: string; name: string | null };
            m.set(row.id, row.name?.trim() || row.id.slice(0, 8));
          }
          for (const uid of ids) {
            if (!m.has(uid)) m.set(uid, uid.slice(0, 8));
          }
          setNameById(m);
        } else {
          setNameById(new Map());
        }
        setErr('');
      }
    } finally {
      setLoading(false);
    }
  }, [messageId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!messageId) return;
    const ch = supabase
      .channel(`poll-votes-${messageId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_chat_poll_votes',
          filter: `message_id=eq.${messageId}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [messageId, load]);

  const counts = parsed.options.map((_, i) => votes.filter((v) => v.option_index === i).length);
  const myVote = userId ? votes.find((v) => v.user_id === userId)?.option_index : undefined;

  async function vote(i: number) {
    if (!userId || voting) return;
    setVoting(true);
    setErr('');
    try {
      const res = await fetch('/api/team-chat/poll-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ message_id: messageId, option_index: i }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(j.error || 'Vote failed');
        return;
      }
      void load();
    } catch {
      setErr('Network error');
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="mt-1 space-y-2">
      <p className="text-sm font-medium text-slate-100">{parsed.question}</p>
      <ul className="space-y-2">
        {parsed.options.map((opt, i) => {
          const c = counts[i] ?? 0;
          const selected = myVote === i;
          const votersHere = votes.filter((v) => v.option_index === i);
          return (
            <li key={i} className="rounded-lg border border-slate-700/50 bg-[#0b141a]/80 overflow-hidden">
              <button
                type="button"
                disabled={!userId || voting || loading}
                onClick={() => void vote(i)}
                className={`w-full text-left px-3 py-2 text-sm border-0 transition ${
                  selected
                    ? 'bg-amber-900/35 text-amber-50'
                    : 'bg-transparent text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span className="font-medium">{opt}</span>
                <span className="float-right tabular-nums text-slate-400">{loading ? '…' : c}</span>
              </button>
              {!loading && votersHere.length > 0 ? (
                <div className="px-3 pb-2 pt-0 border-t border-slate-700/40">
                  <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Who voted</p>
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    {votersHere.map((v) => (
                      <span
                        key={v.user_id}
                        className="text-[11px] font-semibold"
                        style={{ color: chatNameColorForUser(v.user_id) }}
                      >
                        {nameById.get(v.user_id) ?? v.user_id.slice(0, 8)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {err ? <p className="text-[11px] text-red-400">{err}</p> : null}
      {!userId ? <p className="text-[10px] text-slate-500">Sign in to vote</p> : null}
    </div>
  );
}

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
  /** Tap the vote count to show who voted — names appear inline next to the option, not below. */
  const [namesOpenFor, setNamesOpenFor] = useState<number | null>(null);

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
          const showNames = namesOpenFor === i && votersHere.length > 0;
          return (
            <li key={i} className="rounded-lg border border-slate-700/50 bg-[#0b141a]/80 overflow-hidden">
              <div className="flex items-center gap-2 px-2 py-2 min-h-[2.75rem]">
                <button
                  type="button"
                  disabled={!userId || voting || loading}
                  onClick={() => void vote(i)}
                  className={`flex-1 min-w-0 text-left text-sm rounded-md px-2 py-1.5 -mx-1 transition ${
                    selected ? 'bg-amber-900/35 text-amber-50' : 'text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <span className="font-medium break-words">{opt}</span>
                  {showNames ? (
                    <span className="text-[11px] font-normal leading-snug">
                      <span className="text-slate-500"> · </span>
                      {votersHere.map((v, idx) => (
                        <span key={v.user_id}>
                          {idx > 0 ? <span className="text-slate-600"> · </span> : null}
                          <span className="font-semibold" style={{ color: chatNameColorForUser(v.user_id) }}>
                            {nameById.get(v.user_id) ?? v.user_id.slice(0, 8)}
                          </span>
                        </span>
                      ))}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  disabled={loading || c === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (c === 0) return;
                    setNamesOpenFor((prev) => (prev === i ? null : i));
                  }}
                  className={`shrink-0 min-w-[2.25rem] rounded-lg px-2 py-1.5 text-sm tabular-nums border transition ${
                    namesOpenFor === i
                      ? 'border-amber-500/60 bg-amber-950/40 text-amber-200'
                      : 'border-slate-600/80 bg-slate-800/90 text-slate-300 hover:bg-slate-700/80'
                  } ${c === 0 ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
                  title={c === 0 ? 'No votes yet' : namesOpenFor === i ? 'Hide names' : 'Show who voted'}
                  aria-expanded={namesOpenFor === i}
                  aria-label={`${c} votes. ${namesOpenFor === i ? 'Hide' : 'Show'} who voted`}
                >
                  {loading ? '…' : c}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {err ? <p className="text-[11px] text-red-400">{err}</p> : null}
      {!userId ? <p className="text-[10px] text-slate-500">Sign in to vote · Tap the number to see names</p> : (
        <p className="text-[10px] text-slate-500">Tap the vote count to show who voted (inline)</p>
      )}
    </div>
  );
}

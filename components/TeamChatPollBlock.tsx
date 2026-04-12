'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ParsedChatBody } from '@/lib/chat-parse';

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
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    if (!messageId) return;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase.from('team_chat_poll_votes').select('*').eq('message_id', messageId);
      if (error) {
        setVotes([]);
        setErr('');
      } else {
        setVotes((data ?? []) as VoteRow[]);
        setErr('');
      }
      setLoading(false);
    })();
  }, [messageId]);

  useEffect(() => {
    load();
  }, [load]);

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
      load();
    } catch {
      setErr('Network error');
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="mt-1 space-y-2">
      <p className="text-sm font-medium text-slate-100">{parsed.question}</p>
      <ul className="space-y-1.5">
        {parsed.options.map((opt, i) => {
          const c = counts[i] ?? 0;
          const selected = myVote === i;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={!userId || voting || loading}
                onClick={() => void vote(i)}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm border transition ${
                  selected
                    ? 'border-amber-400/80 bg-amber-900/40 text-amber-50'
                    : 'border-slate-600/80 bg-[#0b141a] text-slate-200 hover:border-slate-500'
                }`}
              >
                <span className="font-medium">{opt}</span>
                <span className="float-right tabular-nums text-slate-400">{loading ? '…' : c}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {err ? <p className="text-[11px] text-red-400">{err}</p> : null}
      {!userId ? <p className="text-[10px] text-slate-500">Sign in to vote</p> : null}
    </div>
  );
}

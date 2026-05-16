'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatUsd } from '@/lib/account-splits';
import { dispatchFinanceUpdated } from '@/lib/finance-events';
import { isPaid } from '@/lib/is-paid';

type RosterMember = { playerId: string; profileId: string; name: string };

type CreatedShare = {
  id: string;
  participant_profile_id: string;
  share_amount: number;
  paid: boolean;
  participantName: string;
};

type CreatedSplit = {
  id: string;
  reason: string;
  place: string | null;
  total_amount: number;
  split_date: string;
  payerName: string;
  shares: CreatedShare[];
};

type MyEntry = {
  shareId: string;
  amount: number;
  paid: boolean;
  reason: string;
  place: string | null;
  splitDate: string;
  payerName: string;
  isPayer: boolean;
};

type OwedRow = {
  shareId: string;
  amount: number;
  fromName: string;
  reason: string;
  place: string | null;
  splitDate: string;
};

export default function AccountsPageClient({ currentProfileId }: { currentProfileId: string }) {
  const router = useRouter();
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [created, setCreated] = useState<CreatedSplit[]>([]);
  const [myEntries, setMyEntries] = useState<MyEntry[]>([]);
  const [owedToMe, setOwedToMe] = useState<OwedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeYou, setIncludeYou] = useState(true);
  const [totalAmount, setTotalAmount] = useState('');
  const [reason, setReason] = useState('');
  const [place, setPlace] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/account-splits', { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not load accounts');
        return;
      }
      setRoster(data.roster ?? []);
      setCreated(data.created ?? []);
      setMyEntries(data.myEntries ?? []);
      setOwedToMe(data.owedToMe ?? []);
    } catch {
      setError('Could not load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectableRoster = useMemo(
    () => roster.filter((r) => r.profileId !== currentProfileId),
    [roster, currentProfileId],
  );

  function toggleProfile(profileId: string) {
    setSelected((prev) => {
      if (!includeYou) {
        return prev.has(profileId) ? new Set() : new Set([profileId]);
      }
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  }

  function setIncludeYouChecked(checked: boolean) {
    setIncludeYou(checked);
    setSelected(new Set());
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const amount = parseFloat(totalAmount);
    if (!reason.trim()) {
      setError('Add a reason for what you spent.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    if (includeYou && selected.size < 1) {
      setError('Select at least one player to split with.');
      return;
    }
    if (!includeYou && selected.size !== 1) {
      setError('Select exactly one player for the full amount.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/account-splits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          participantProfileIds: Array.from(selected),
          totalAmount: amount,
          reason: reason.trim(),
          place: place.trim() || undefined,
          includeYou,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not create split');
        return;
      }
      setTotalAmount('');
      setReason('');
      setPlace('');
      setSelected(new Set());
      dispatchFinanceUpdated();
      router.refresh();
      await load();
    } catch {
      setError('Could not create split');
    } finally {
      setSubmitting(false);
    }
  }

  async function setSharePaid(shareId: string, paid: boolean) {
    setUpdatingId(shareId);
    try {
      const res = await fetch(`/api/account-splits/shares/${shareId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ paid }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not update');
        return;
      }
      dispatchFinanceUpdated();
      router.refresh();
      await load();
    } catch {
      setError('Could not update');
    } finally {
      setUpdatingId(null);
    }
  }

  const amountNum = parseFloat(totalAmount);
  const previewCount = includeYou ? selected.size + 1 : selected.size;
  const previewEach =
    includeYou && previewCount > 0 && Number.isFinite(amountNum)
      ? formatUsd(amountNum / previewCount)
      : null;
  const previewOwed =
    !includeYou && selected.size === 1 && Number.isFinite(amountNum) ? formatUsd(amountNum) : null;

  return (
    <div className="space-y-8 max-w-3xl">
      <p className="text-slate-400 text-sm leading-relaxed">
        Log what you paid. With <strong className="text-slate-300 font-medium">Include you</strong>, we split the total
        equally among you and the players you pick. Uncheck it to charge one player the full amount.
      </p>

      {error ? (
        <p className="text-red-400 text-sm rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2" role="alert">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleCreate} className="card space-y-4">
        <h3 className="text-lg font-semibold text-[var(--pirate-yellow)]">New split</h3>

        <div>
          <label className="block text-xs text-slate-500 mb-1">Total amount ($)</label>
          <input
            className="input-field"
            type="number"
            min="0.01"
            step="0.01"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="100.00"
            required
          />
          <label className="mt-3 flex items-center gap-2 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={includeYou}
              onChange={(e) => setIncludeYouChecked(e.target.checked)}
              className="rounded border-slate-500 text-amber-500"
            />
            <span className="text-sm text-slate-300">Include you</span>
          </label>
          {previewEach ? (
            <p className="text-xs text-slate-500 mt-1">
              Split equally: <span className="text-amber-200">${previewEach}</span> each ({previewCount} people
              including you)
            </p>
          ) : null}
          {previewOwed ? (
            <p className="text-xs text-slate-500 mt-1">
              <span className="text-white">{selectableRoster.find((m) => selected.has(m.profileId))?.name}</span> owes
              you: <span className="text-amber-200">${previewOwed}</span>
            </p>
          ) : null}
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">Reason (what you spent on)</label>
          <input
            className="input-field"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Team dinner, transport, equipment…"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">Place (optional)</label>
          <input
            className="input-field"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="Restaurant, ground, shop…"
          />
        </div>

        <div>
          <p className="text-xs text-slate-500 mb-2">
            {includeYou ? 'Split with (players with an account)' : 'Who owes you? (pick one)'}
          </p>
          {selectableRoster.length === 0 ? (
            <p className="text-slate-500 text-sm">No other linked players yet.</p>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {selectableRoster.map((m) => (
                <li key={m.profileId}>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-600/80 bg-slate-900/50 px-3 py-2 cursor-pointer hover:border-amber-500/40">
                    <input
                      type={includeYou ? 'checkbox' : 'radio'}
                      name={includeYou ? undefined : 'account-charge-player'}
                      checked={selected.has(m.profileId)}
                      onChange={() => toggleProfile(m.profileId)}
                      className={includeYou ? 'rounded border-slate-500 text-amber-500' : 'border-slate-500 text-amber-500'}
                    />
                    <span className="text-sm text-white truncate">{m.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="submit" className="btn-primary" disabled={submitting || loading}>
          {submitting ? 'Saving…' : includeYou ? 'Split equally' : 'Add charge'}
        </button>
      </form>

      {loading ? <p className="text-slate-500 text-sm">Loading…</p> : null}

      {myEntries.length > 0 ? (
        <section className="card">
          <h3 className="text-lg font-semibold text-[var(--pirate-yellow)] mb-3">Your shares</h3>
          <ol className="space-y-3 list-decimal list-inside text-sm">
            {myEntries.map((e) => (
              <li key={e.shareId} className="border-b border-slate-700/60 pb-3 last:border-0">
                <span className="font-medium text-white">
                  {e.payerName}
                  {e.isPayer ? ' (you paid)' : ''}
                </span>
                <span className="text-slate-400"> — </span>
                <span className="tabular-nums text-amber-200">${formatUsd(e.amount)}</span>
                <p className="text-slate-300 mt-0.5 pl-5">
                  {e.reason}
                  {e.place ? ` · ${e.place}` : ''}
                </p>
                <div className="pl-5 mt-1 flex flex-wrap items-center gap-2">
                  <span className={isPaid(e.paid) ? 'text-emerald-300' : 'text-red-300'}>
                    {isPaid(e.paid) ? 'Paid' : 'Pending'}
                  </span>
                  {!isPaid(e.paid) && !e.isPayer ? (
                    <button
                      type="button"
                      className="text-xs text-amber-300 hover:underline"
                      disabled={updatingId === e.shareId}
                      onClick={() => void setSharePaid(e.shareId, true)}
                    >
                      Mark paid
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {created.length > 0 ? (
        <section className="card">
          <h3 className="text-lg font-semibold text-[var(--pirate-yellow)] mb-3">Splits you added</h3>
          <ul className="space-y-4 text-sm">
            {created.map((s) => (
              <li key={s.id} className="border border-slate-700/60 rounded-lg p-3 bg-slate-900/40">
                <p className="text-white font-medium">
                  ${formatUsd(Number(s.total_amount))} — {s.reason}
                  {s.place ? <span className="text-slate-400"> @ {s.place}</span> : null}
                </p>
                <p className="text-xs text-slate-500 mt-1">{s.split_date}</p>
                <ul className="mt-2 space-y-1">
                  {s.shares.map((sh) => (
                    <li key={sh.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-slate-300">
                        {sh.participantName} — ${formatUsd(Number(sh.share_amount))}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={isPaid(sh.paid) ? 'text-emerald-300 text-xs' : 'text-red-300 text-xs'}>
                          {isPaid(sh.paid) ? 'Paid' : 'Pending'}
                        </span>
                        {!isPaid(sh.paid) ? (
                          <button
                            type="button"
                            className="text-xs text-amber-300 hover:underline"
                            disabled={updatingId === sh.id}
                            onClick={() => void setSharePaid(sh.id, true)}
                          >
                            Mark paid
                          </button>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {owedToMe.length > 0 ? (
        <section className="card border-emerald-600/40">
          <h3 className="text-lg font-semibold text-emerald-300 mb-3">Owed to you</h3>
          <ul className="space-y-2 text-sm">
            {owedToMe.map((o) => (
              <li key={o.shareId} className="flex flex-wrap justify-between gap-2">
                <span className="text-slate-200">
                  {o.fromName} — {o.reason}
                  {o.place ? ` @ ${o.place}` : ''}
                </span>
                <span className="text-amber-200 tabular-nums">${formatUsd(o.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

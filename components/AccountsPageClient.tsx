'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, isValid, parseISO } from 'date-fns';
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
  created_at: string;
  created_by_profile_id: string;
  payerName: string;
  creatorName: string;
  canManage: boolean;
  shares: CreatedShare[];
};

type CreatorBlock = {
  creatorProfileId: string;
  creatorName: string;
  splits: CreatedSplit[];
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

type DateSplitBatch = {
  dateKey: string;
  label: string;
  splits: CreatedSplit[];
};

function formatSplitDateLabel(dateKey: string): string {
  if (!dateKey || dateKey === 'unknown') return 'No date';
  try {
    const d = parseISO(dateKey.slice(0, 10));
    return isValid(d) ? format(d, 'MMMM d, yyyy') : dateKey;
  } catch {
    return dateKey;
  }
}

function groupSplitsByDate(splits: CreatedSplit[]): DateSplitBatch[] {
  const byDate = new Map<string, CreatedSplit[]>();
  for (const s of splits) {
    const key = (s.split_date ?? '').slice(0, 10) || 'unknown';
    const list = byDate.get(key) ?? [];
    list.push(s);
    byDate.set(key, list);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, items]) => ({
      dateKey,
      label: formatSplitDateLabel(dateKey),
      splits: [...items].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
    }));
}

function SplitRowCard({
  split,
  updatingId,
  onTogglePaid,
  onDelete,
  onSaveEdit,
}: {
  split: CreatedSplit;
  updatingId: string | null;
  onTogglePaid: (shareId: string, paid: boolean) => void;
  onDelete: (splitId: string) => void;
  onSaveEdit: (
    splitId: string,
    payload: { reason: string; place: string; totalAmount: number },
  ) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editReason, setEditReason] = useState(split.reason);
  const [editPlace, setEditPlace] = useState(split.place ?? '');
  const [editAmount, setEditAmount] = useState(String(split.total_amount));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      setEditReason(split.reason);
      setEditPlace(split.place ?? '');
      setEditAmount(String(split.total_amount));
    }
  }, [split, editing]);

  async function handleSave() {
    const amount = parseFloat(editAmount);
    if (!editReason.trim() || !Number.isFinite(amount) || amount <= 0) return;
    setSaving(true);
    try {
      await onSaveEdit(split.id, {
        reason: editReason.trim(),
        place: editPlace.trim(),
        totalAmount: amount,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="border border-slate-700/60 rounded-lg p-3 bg-slate-900/40">
      {editing ? (
        <div className="space-y-2">
          <input
            className="input-field text-sm"
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            placeholder="Reason"
          />
          <input
            className="input-field text-sm"
            value={editPlace}
            onChange={(e) => setEditPlace(e.target.value)}
            placeholder="Place (optional)"
          />
          <input
            className="input-field text-sm"
            type="number"
            min="0.01"
            step="0.01"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-xs py-1.5 px-3" disabled={saving} onClick={() => void handleSave()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-white"
              disabled={saving}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-white font-medium">
                ${formatUsd(Number(split.total_amount))} — {split.reason}
                {split.place ? <span className="text-slate-400"> @ {split.place}</span> : null}
              </p>
              <p className="text-xs text-slate-500 mt-1">{split.split_date}</p>
            </div>
            {split.canManage ? (
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  className="text-xs text-amber-300 hover:underline"
                  onClick={() => setEditing(true)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-xs text-red-400 hover:underline"
                  onClick={() => onDelete(split.id)}
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
          <ul className="mt-2 space-y-1.5">
            {split.shares.map((sh) => (
              <li key={sh.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-300">
                  {sh.participantName} — ${formatUsd(Number(sh.share_amount))}
                </span>
                {split.canManage ? (
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={isPaid(sh.paid)}
                      disabled={updatingId === sh.id}
                      onChange={(e) => onTogglePaid(sh.id, e.target.checked)}
                      className="rounded border-slate-500 text-emerald-500"
                    />
                    <span className={isPaid(sh.paid) ? 'text-emerald-300' : 'text-red-300'}>
                      {isPaid(sh.paid) ? 'Paid' : 'Unpaid'}
                    </span>
                  </label>
                ) : (
                  <span className={isPaid(sh.paid) ? 'text-emerald-300 text-xs' : 'text-red-300 text-xs'}>
                    {isPaid(sh.paid) ? 'Paid' : 'Unpaid'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

export default function AccountsPageClient({ currentProfileId }: { currentProfileId: string }) {
  const router = useRouter();
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [splitsByCreator, setSplitsByCreator] = useState<CreatorBlock[]>([]);
  const [myEntries, setMyEntries] = useState<MyEntry[]>([]);
  const [owedToMe, setOwedToMe] = useState<OwedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeYou, setIncludeYou] = useState(true);
  const [totalAmount, setTotalAmount] = useState('');
  const [reason, setReason] = useState('');
  const [place, setPlace] = useState('');
  const [splitDate, setSplitDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedCreators, setExpandedCreators] = useState<Set<string>>(new Set());

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
      setSplitsByCreator(data.splitsByCreator ?? []);
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

  const totalSplits = useMemo(
    () => splitsByCreator.reduce((n, b) => n + b.splits.length, 0),
    [splitsByCreator],
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

  function toggleCreatorBlock(creatorProfileId: string) {
    setExpandedCreators((prev) => {
      const next = new Set(prev);
      if (next.has(creatorProfileId)) next.delete(creatorProfileId);
      else next.add(creatorProfileId);
      return next;
    });
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
          splitDate: splitDate.trim() || undefined,
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
      setSplitDate('');
      setSelected(new Set());
      setExpandedCreators((prev) => new Set(prev).add(currentProfileId));
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

  async function deleteSplit(splitId: string) {
    if (!window.confirm('Delete this split? This cannot be undone.')) return;
    setUpdatingId(splitId);
    try {
      const res = await fetch(`/api/account-splits/${splitId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not delete');
        return;
      }
      dispatchFinanceUpdated();
      router.refresh();
      await load();
    } catch {
      setError('Could not delete');
    } finally {
      setUpdatingId(null);
    }
  }

  async function saveSplitEdit(
    splitId: string,
    payload: { reason: string; place: string; totalAmount: number },
  ) {
    const res = await fetch(`/api/account-splits/${splitId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        reason: payload.reason,
        place: payload.place || undefined,
        totalAmount: payload.totalAmount,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Could not save');
      throw new Error(data.error);
    }
    dispatchFinanceUpdated();
    router.refresh();
    await load();
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
          <label className="block text-xs text-slate-500 mb-1">Date (optional)</label>
          <input
            className="input-field"
            type="date"
            value={splitDate}
            onChange={(e) => setSplitDate(e.target.value)}
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
                <div className="pl-5 mt-1">
                  <span className={isPaid(e.paid) ? 'text-emerald-300' : 'text-red-300'}>
                    {isPaid(e.paid) ? 'Paid' : 'Pending'}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {totalSplits > 0 ? (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-[var(--pirate-yellow)]">Splits added</h3>
          {splitsByCreator.map((block) => {
            const isOpen = expandedCreators.has(block.creatorProfileId);
            const dateBatches = groupSplitsByDate(block.splits);
            const isOwn = block.creatorProfileId === currentProfileId;
            return (
              <div
                key={block.creatorProfileId}
                className={`card border-l-4 overflow-hidden ${
                  isOwn ? 'border-l-amber-400/80' : 'border-l-slate-600'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleCreatorBlock(block.creatorProfileId)}
                  className="w-full flex items-center gap-3 text-left py-1 pr-1 hover:bg-slate-800/40 rounded-lg transition-colors"
                  aria-expanded={isOpen}
                >
                  <span
                    className={`text-slate-400 text-xs shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    aria-hidden
                  >
                    ▶
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="text-base font-semibold text-white block truncate">{block.creatorName}</span>
                    <span className="text-xs text-slate-500">
                      {block.splits.length} split{block.splits.length === 1 ? '' : 's'}
                      {dateBatches.length > 0
                        ? ` · ${dateBatches.length} day${dateBatches.length === 1 ? '' : 's'}`
                        : ''}
                      {isOwn ? ' · you can edit' : ''}
                    </span>
                  </span>
                </button>

                {isOpen ? (
                  <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-4">
                    {dateBatches.map((batch) => (
                      <div key={`${block.creatorProfileId}-${batch.dateKey}`}>
                        <p className="text-xs font-medium text-amber-200/90 uppercase tracking-wide mb-2">
                          {batch.label}
                          <span className="text-slate-500 font-normal normal-case ml-2">
                            ({batch.splits.length})
                          </span>
                        </p>
                        <ul className="space-y-3 text-sm">
                          {batch.splits.map((s) => (
                            <SplitRowCard
                              key={s.id}
                              split={s}
                              updatingId={updatingId}
                              onTogglePaid={(shareId, paid) => void setSharePaid(shareId, paid)}
                              onDelete={(splitId) => void deleteSplit(splitId)}
                              onSaveEdit={saveSplitEdit}
                            />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
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

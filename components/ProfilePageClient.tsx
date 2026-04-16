'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { format, parseISO, isValid } from 'date-fns';
import { compressImageForUpload } from '@/lib/image-compress';
import LogoutButton from '@/components/LogoutButton';
import { isUmpiringDutyCompleted } from '@/lib/umpiring-duties';
import { isPaid } from '@/lib/is-paid';
import { NEW_JERSEY_AMOUNT_USD } from '@/lib/jersey-utils';

type Profile = {
  name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
};

function formatDobDisplay(ymd: string | null): string {
  if (!ymd) return '—';
  try {
    const d = parseISO(ymd.slice(0, 10));
    return isValid(d) ? format(d, 'MMMM d, yyyy') : '—';
  } catch {
    return '—';
  }
}
type Duty = {
  id?: string;
  who: string;
  duty_date: string;
  duty_time?: string | null;
  notes: string | null;
};

export type ProfileContributionEntry = {
  id: string;
  amount: number;
  date: string;
  notes: string | null;
  paid: boolean;
};

function formatContributionDate(ymd: string): string {
  try {
    const d = parseISO(ymd.slice(0, 10));
    return isValid(d) ? format(d, 'MMM d, yyyy') : ymd;
  } catch {
    return ymd;
  }
}

/** Display like #03 for numeric jersey numbers. */
function formatJerseyHash(num: string): string {
  const t = num.trim();
  if (!t) return '#—';
  if (/^\d+$/.test(t)) return `#${t.padStart(2, '0')}`;
  return `#${t}`;
}

export default function ProfilePageClient({
  initialProfile,
  contributionEntries = [],
  matchesPlayed,
  umpiringDuties,
  umpiringReminder = null,
  pendingJersey = 0,
  pendingContribution = 0,
  jerseyEntries = [],
  playerId,
  assignedPlayerMatchFeeUsd = null,
}: {
  initialProfile: Profile;
  contributionEntries?: ProfileContributionEntry[];
  matchesPlayed: number;
  umpiringDuties: Duty[];
  umpiringReminder?: string | null;
  pendingJersey?: number;
  pendingContribution?: number;
  /** User's jersey rows (paid status mirrors admin / jerseys page). */
  jerseyEntries?: { id: string; jerseyNumber: string; paid: boolean }[];
  playerId?: string | null;
  /** Team Budget standard player match fee (admin); optional. */
  assignedPlayerMatchFeeUsd?: number | null;
}) {
  const router = useRouter();
  /** Server-sourced pending sums; coerce so header never fights string-concat or stale shapes. */
  const totalPending = Number(pendingJersey) + Number(pendingContribution);
  const jerseyCount = jerseyEntries.length;
  const contribCount = contributionEntries.length;
  const totalFinanceItems = jerseyCount + contribCount;
  const hasTeamStandardFee =
    assignedPlayerMatchFeeUsd != null && assignedPlayerMatchFeeUsd > 0;
  /** Show match-fee summary when team set a standard or the player has contribution rows. */
  const showPlayerMatchFeeBlock = hasTeamStandardFee || contribCount > 0;
  const matchFeeAmountLabelCount =
    contribCount > 0 ? contribCount : hasTeamStandardFee ? 1 : 0;
  const matchFeeDisplayAmountUsd = hasTeamStandardFee
    ? Number(assignedPlayerMatchFeeUsd)
    : contribCount > 0
      ? contributionEntries.reduce((s, e) => s + e.amount, 0)
      : 0;
  const matchFeeLinePaid =
    contribCount === 0
      ? false
      : contributionEntries.every((e) => isPaid(e.paid));
  const cents = Math.round(matchFeeDisplayAmountUsd * 100);
  const matchFeeAmountStr = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  const hasLedgerLines = totalFinanceItems > 0;
  const anyUnpaidLine =
    jerseyEntries.some((j) => !isPaid(j.paid)) ||
    contributionEntries.some((e) => !isPaid(e.paid));
  /** Must match totals: “All paid” only when nothing owed (same as $0 total) and every line marked paid. */
  type OweTone = 'empty' | 'all' | 'outstanding';
  const oweTone: OweTone =
    !hasLedgerLines && !showPlayerMatchFeeBlock
      ? 'empty'
      : !hasLedgerLines && showPlayerMatchFeeBlock
        ? 'empty'
        : anyUnpaidLine || totalPending > 0.005
          ? 'outstanding'
          : 'all';
  const oweBlockClass =
    oweTone === 'all'
      ? 'border-emerald-500/75 bg-emerald-950/55 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.15)]'
      : oweTone === 'empty'
        ? 'border-slate-600/80 bg-slate-900/55'
        : 'border-red-500/70 bg-red-950/50 shadow-[inset_0_1px_0_0_rgba(239,68,68,0.12)]';
  const [profile, setProfile] = useState(initialProfile);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialProfile.name ?? '');
  const [phone, setPhone] = useState(initialProfile.phone ?? '');
  const [dob, setDob] = useState(
    initialProfile.date_of_birth ? initialProfile.date_of_birth.slice(0, 10) : '',
  );
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatar_url ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [profileFormError, setProfileFormError] = useState('');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarFile) {
      setFilePreviewUrl(null);
      return;
    }
    const u = URL.createObjectURL(avatarFile);
    setFilePreviewUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [avatarFile]);

  useEffect(() => {
    if (editing) return;
    setProfile(initialProfile);
    setName(initialProfile.name ?? '');
    setPhone(initialProfile.phone ?? '');
    setDob(initialProfile.date_of_birth ? initialProfile.date_of_birth.slice(0, 10) : '');
    setAvatarUrl(initialProfile.avatar_url ?? '');
  }, [
    editing,
    initialProfile.name,
    initialProfile.phone,
    initialProfile.avatar_url,
    initialProfile.date_of_birth,
    initialProfile.email,
  ]);

  async function handleSave() {
    setProfileFormError('');
    if (!dob.trim()) {
      setProfileFormError('Date of birth is required.');
      return;
    }
    setSaving(true);
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) {
        setProfileFormError('You must be signed in to save.');
        return;
      }

      let nextAvatarUrl = avatarUrl.trim() || null;
      if (avatarFile) {
        const compressed = await compressImageForUpload(avatarFile, { maxBytes: 2_400_000, maxEdge: 2000 });
        const ext = compressed.name.split('.').pop() || 'jpg';
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, compressed, {
          upsert: true,
        });
        if (uploadError) {
          setProfileFormError(`Photo upload failed: ${uploadError.message}. Check Storage policies for the “avatars” bucket.`);
          return;
        }
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        nextAvatarUrl = urlData.publicUrl;
      }

      const dobValue = dob.trim() ? dob.trim().slice(0, 10) : null;
      const { error: profileErr } = await (supabase as any)
        .from('profiles')
        .update({
          name: name.trim() || null,
          phone: phone.trim() || null,
          date_of_birth: dobValue,
          avatar_url: nextAvatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileErr) {
        const msg = profileErr.message || 'Could not update profile.';
        if (
          msg.includes('date_of_birth') ||
          msg.toLowerCase().includes('schema cache') ||
          msg.includes('PGRST204')
        ) {
          setProfileFormError(
            'The profiles table needs the date_of_birth column and a fresh API schema. In Supabase → SQL Editor, run supabase/alter_profiles_dob.sql (it adds the column and runs NOTIFY pgrst reload). If the column already exists, run only: NOTIFY pgrst, \'reload schema\';',
          );
        } else {
          setProfileFormError(msg);
        }
        return;
      }

      if (playerId) {
        const displayName = (name.trim() || profile.name || profile.email || 'Player').trim();
        const { error: playerErr } = await (supabase as any)
          .from('players')
          .update({
            name: displayName,
            photo: nextAvatarUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', playerId);
        if (playerErr && typeof window !== 'undefined') {
          window.alert(
            `Your profile was saved, but the Players card could not be updated: ${playerErr.message}`,
          );
        }
      }

      setProfile((prev) => ({
        ...prev,
        name: name.trim() || null,
        phone: phone.trim() || null,
        date_of_birth: dobValue,
        avatar_url: nextAvatarUrl,
      }));
      setAvatarFile(null);
      setEditing(false);
      setSaveNotice('Saved.');
      window.setTimeout(() => setSaveNotice(null), 5000);
      router.refresh();
    } catch (e) {
      setProfileFormError(e instanceof Error ? e.message : 'Something went wrong while saving.');
    } finally {
      setSaving(false);
    }
  }

  const headerPhotoSrc =
    editing && (filePreviewUrl || avatarUrl.trim())
      ? filePreviewUrl || avatarUrl.trim()
      : profile.avatar_url;
  const headerPhotoIsBlob = typeof headerPhotoSrc === 'string' && headerPhotoSrc.startsWith('blob:');

  return (
    <div className="card max-w-2xl space-y-6">
      {saveNotice ? (
        <p className="rounded-lg bg-emerald-900/50 border border-emerald-600/50 text-emerald-200 text-sm px-3 py-2" role="status">
          {saveNotice}
        </p>
      ) : null}
      {umpiringReminder ? (
        <p
          className="rounded-lg bg-amber-900/35 border border-amber-400/45 text-amber-100 text-sm px-3 py-2"
          role="status"
        >
          {umpiringReminder}
        </p>
      ) : null}
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-[var(--pirate-yellow)] bg-[var(--pirate-navy)] flex-shrink-0">
          {headerPhotoSrc ? (
            headerPhotoIsBlob ? (
              // eslint-disable-next-line @next/next/no-img-element -- blob preview before upload
              <img src={headerPhotoSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <Image
                key={headerPhotoSrc}
                src={headerPhotoSrc}
                alt=""
                fill
                className="object-cover"
                sizes="112px"
                unoptimized
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">👤</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {!editing ? (
            <>
              <p className="text-lg font-semibold text-white">{profile.name || '—'}</p>
              <div className="mt-3 rounded-lg border border-slate-600/70 bg-slate-900/50 p-3 space-y-1.5">
                <p className="text-slate-300 text-sm">
                  <span className="text-slate-500">Email</span> — {profile.email || '—'}
                </p>
                <p className="text-slate-300 text-sm">
                  <span className="text-slate-500">Ph</span> — {profile.phone || '—'}
                </p>
                <p className="text-slate-300 text-sm">
                  <span className="text-slate-500">DOB</span> — {formatDobDisplay(profile.date_of_birth)}
                </p>
              </div>
              <button type="button" onClick={() => setEditing(true)} className="btn-secondary text-sm mt-3">
                Edit profile
              </button>
            </>
          ) : (
            <div className="space-y-2">
              {profileFormError ? (
                <p className="text-red-400 text-sm" role="alert">
                  {profileFormError}
                </p>
              ) : null}
              <input className="input-field" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <p className="text-slate-500 text-sm">
                <span className="text-slate-400">Email</span> — {profile.email}
              </p>
              <input className="input-field" placeholder="Ph" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <label className="block text-slate-300 text-sm font-medium">
                DOB <span className="text-red-400">*</span>
              </label>
              <input className="input-field" type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
              <input className="input-field" placeholder="Photo URL" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
              <input
                type="file"
                accept="image/*,.heic,.heif"
                className="input-field"
                onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-slate-500 text-xs">Choose a photo from your device (library or files). URL still works too.</p>
              <p className="text-slate-500 text-xs">Email cannot be changed here.</p>
              <div className="flex gap-2">
                <button type="button" onClick={handleSave} className="btn-primary text-sm" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setName(profile.name ?? '');
                    setPhone(profile.phone ?? '');
                    setDob(profile.date_of_birth ? profile.date_of_birth.slice(0, 10) : '');
                    setAvatarUrl(profile.avatar_url ?? '');
                    setAvatarFile(null);
                  }}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-[var(--pirate-yellow)] mb-2 tracking-[0.12em] font-['Times_New_Roman',Times,serif] text-lg">
          WHAT YOU OWE
        </h3>
        <div
          className={`rounded-xl border-2 px-4 py-4 sm:px-5 sm:py-5 ${oweBlockClass}`}
          role="region"
          aria-label="Jersey and contribution balances"
        >
          {oweTone === 'empty' && !showPlayerMatchFeeBlock ? (
            <p className="text-slate-400 text-sm leading-relaxed">
              No jersey orders or match fees / contributions on your record yet.
            </p>
          ) : (
            <>
              {!hasLedgerLines && showPlayerMatchFeeBlock ? (
                <p className="text-xs text-slate-400 border-b border-white/10 pb-3 mb-4">
                  Standard match fee is set in <span className="text-slate-300">Team Budget → Player match fees</span>. Your
                  payment lines appear below when recorded.
                </p>
              ) : null}
              {hasLedgerLines ? (
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4 border-b border-white/10 pb-3 mb-4">
                <div>
                  <p
                    className={`flex items-center gap-2 flex-wrap text-sm font-semibold uppercase tracking-wide ${
                      oweTone === 'all' ? 'text-emerald-200' : 'text-red-200'
                    }`}
                  >
                    {oweTone !== 'all' && (
                      <span className="inline-flex shrink-0 text-red-400" aria-hidden>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 8v4" />
                          <path d="M12 16h.01" />
                        </svg>
                      </span>
                    )}
                    {oweTone === 'all' ? 'All paid' : 'Outstanding'}
                  </p>
                  {oweTone === 'all' ? (
                    <p className="text-xs mt-1 text-emerald-100/90">
                      All jersey orders and match fee / player contribution lines below are paid.
                    </p>
                  ) : null}
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <p className="text-[11px] uppercase tracking-wide opacity-80 text-white/80">Total still owed</p>
                  <p className="text-2xl font-bold tabular-nums text-white">${totalPending.toFixed(2)}</p>
                </div>
              </div>
              ) : null}

              {jerseyCount > 0 && (
                <div className="mb-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
                    Jersey orders and details
                  </p>
                  <p className="text-xs text-white/55 mt-1 mb-3">
                    {jerseyCount} jersey order{jerseyCount === 1 ? '' : 's'}
                  </p>
                  <ul className="space-y-2.5 text-sm list-none pl-0">
                    {jerseyEntries.map((j) => (
                      <li
                        key={j.id}
                        className="border-b border-white/5 pb-2.5 last:border-0 last:pb-0"
                      >
                        <p className="text-white font-medium leading-snug">
                          {formatJerseyHash(j.jerseyNumber)} - ${NEW_JERSEY_AMOUNT_USD.toFixed(0)}{' '}
                          {isPaid(j.paid) ? (
                            <span className="text-emerald-300">paid</span>
                          ) : (
                            <span className="text-amber-200">unpaid</span>
                          )}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {showPlayerMatchFeeBlock && (
                <div className="mb-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
                    Player match fee
                  </p>
                  <p className="text-xs text-white/55 mt-1 mb-3">
                    {matchFeeAmountLabelCount} amount{matchFeeAmountLabelCount !== 1 ? 's' : ''}
                  </p>
                  <ul className="space-y-2.5 text-sm list-none pl-0">
                    <li className="border-b border-white/5 pb-2.5 last:border-0 last:pb-0">
                      <p className="text-white font-medium leading-snug tabular-nums">
                        ${matchFeeAmountStr} -{' '}
                        {matchFeeLinePaid ? (
                          <span className="text-emerald-300">paid</span>
                        ) : (
                          <span className="text-amber-200">unpaid</span>
                        )}
                      </p>
                    </li>
                  </ul>
                  {contribCount > 1 ? (
                    <ul className="mt-3 space-y-2 text-[11px] text-white/45 list-none pl-0 border-t border-white/5 pt-3">
                      {contributionEntries.map((e) => (
                        <li key={e.id}>
                          ${e.amount.toFixed(2)} · {formatContributionDate(e.date)}
                          {e.notes?.trim() ? ` · ${e.notes.trim()}` : ''}
                          {isPaid(e.paid) ? ' · paid' : ' · unpaid'}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-[var(--pirate-yellow)] mb-2">Umpire duties</h3>
        {umpiringDuties.length === 0 ? (
          <p className="text-slate-400 text-sm">Nothing yet</p>
        ) : (
          <ul className="text-sm text-slate-300 space-y-2">
            {umpiringDuties.map((d, i) => {
              const t = (d.duty_time || '12:00').trim();
              const done = isUmpiringDutyCompleted(d.duty_date, d.duty_time);
              return (
                <li key={d.id ?? i} className="text-slate-300">
                  <span className="text-white">
                    {format(new Date(d.duty_date.slice(0, 10)), 'MMM d, yyyy')}
                    {` at ${t}`}
                    {done && (
                      <span className="ml-2 inline-block rounded px-2 py-0.5 text-xs font-medium bg-emerald-900/60 text-emerald-300">
                        Completed
                      </span>
                    )}
                  </span>
                  {d.notes ? (
                    <span className="text-slate-400 block sm:inline sm:ml-1"> · Note (admin): {d.notes}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-[var(--pirate-yellow)] mb-2">Total matches played</h3>
        <p className="text-white">{matchesPlayed}</p>
      </div>

      <div className="pt-6 mt-2 border-t border-slate-700 flex justify-center">
        <LogoutButton />
      </div>
    </div>
  );
}

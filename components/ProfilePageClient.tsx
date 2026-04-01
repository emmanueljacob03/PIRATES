'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { format, parseISO, isValid } from 'date-fns';
import { compressImageForUpload } from '@/lib/image-compress';

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
type Duty = { who: string; duty_date: string; notes: string };

export default function ProfilePageClient({
  initialProfile,
  contributionTotal,
  matchesPlayed,
  umpiringDuties,
  pendingJersey = 0,
  pendingContribution = 0,
  playerId,
}: {
  initialProfile: Profile;
  contributionTotal: number;
  matchesPlayed: number;
  umpiringDuties: Duty[];
  pendingJersey?: number;
  pendingContribution?: number;
  playerId?: string | null;
}) {
  const router = useRouter();
  const totalPending = pendingJersey + pendingContribution;
  const [profile, setProfile] = useState(initialProfile);
  const [viewMoreContrib, setViewMoreContrib] = useState(false);
  const [viewMoreMatches, setViewMoreMatches] = useState(false);
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
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                  Email, phone & date of birth
                </p>
                <p className="text-slate-300 text-sm">
                  <span className="text-slate-500">Email</span> — {profile.email || '—'}
                </p>
                <p className="text-slate-300 text-sm">
                  <span className="text-slate-500">Phone</span> — {profile.phone || '—'}
                </p>
                <p className="text-slate-300 text-sm">
                  <span className="text-slate-500">Date of birth</span> — {formatDobDisplay(profile.date_of_birth)}
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
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Email, phone & DOB</p>
              <input className="input-field" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <p className="text-slate-500 text-xs">Email (read-only): {profile.email}</p>
              <input className="input-field" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <label className="block text-slate-300 text-sm font-medium">
                Date of birth <span className="text-red-400">*</span>
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
        <h3 className="font-semibold text-[var(--pirate-yellow)] mb-2">Umpire duties</h3>
        {umpiringDuties.length === 0 ? (
          <p className="text-slate-400 text-sm">Nothing yet</p>
        ) : (
          <ul className="text-sm text-slate-300 space-y-1">
            {umpiringDuties.map((d, i) => (
              <li key={i}>{d.who} — {format(new Date(d.duty_date), 'MMM d, yyyy')} {d.notes && `(${d.notes})`}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-[var(--pirate-yellow)] mb-2">What you owe</h3>
        <p className="text-white text-lg">${totalPending.toFixed(2)}</p>
        <p className="text-slate-400 text-sm mt-1">
          Jersey: ${pendingJersey.toFixed(0)} &nbsp;|&nbsp; Player contribution / match fee: $
          {pendingContribution.toFixed(2)}
        </p>
      </div>

      <div>
        <h3 className="font-semibold text-[var(--pirate-yellow)] mb-2">Contribution did</h3>
        <p className="text-white">${contributionTotal.toFixed(2)}</p>
        <button type="button" onClick={() => setViewMoreContrib(!viewMoreContrib)} className="text-sm text-[var(--pirate-yellow)] hover:underline mt-1">
          {viewMoreContrib ? 'Show less' : 'View more'}
        </button>
        {viewMoreContrib && <p className="text-slate-500 text-sm mt-1">Total contribution across all entries.</p>}
      </div>

      <div>
        <h3 className="font-semibold text-[var(--pirate-yellow)] mb-2">Total matches played</h3>
        <p className="text-white">{matchesPlayed}</p>
        <button type="button" onClick={() => setViewMoreMatches(!viewMoreMatches)} className="text-sm text-[var(--pirate-yellow)] hover:underline mt-1">
          {viewMoreMatches ? 'Show less' : 'View more'}
        </button>
        {viewMoreMatches && <p className="text-slate-500 text-sm mt-1">Based on scorecard entries.</p>}
      </div>
    </div>
  );
}

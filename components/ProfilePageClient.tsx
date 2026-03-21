'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

type Profile = { name: string | null; email: string; phone: string | null; avatar_url: string | null };
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
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatar_url ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      let nextAvatarUrl = avatarUrl.trim() || null;
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop() || 'png';
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
          nextAvatarUrl = urlData.publicUrl;
        }
      }
      await (supabase as any)
        .from('profiles')
        .update({
          name: name.trim() || null,
          phone: phone.trim() || null,
          avatar_url: nextAvatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      // Keep linked player card (Players page) in sync with profile name + photo
      if (playerId) {
        const displayName = (name.trim() || profile.name || profile.email || 'Player').trim();
        await (supabase as any)
          .from('players')
          .update({
            name: displayName,
            photo: nextAvatarUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', playerId);
      }
      setProfile((p) => ({ ...p, name: name.trim() || null, phone: phone.trim() || null, avatar_url: nextAvatarUrl }));
      router.refresh();
    }
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="card max-w-2xl space-y-6">
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-[var(--pirate-yellow)] bg-[var(--pirate-navy)] flex-shrink-0">
          {profile.avatar_url ? (
            <Image src={profile.avatar_url} alt="" fill className="object-cover" sizes="112px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">👤</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {!editing ? (
            <>
              <p className="text-lg font-semibold text-white">{profile.name || '—'}</p>
              <p className="text-slate-400 text-sm">Email: {profile.email || '—'}</p>
              <p className="text-slate-400 text-sm">Phone: {profile.phone || '—'}</p>
              <button type="button" onClick={() => setEditing(true)} className="btn-secondary text-sm mt-2">
                Edit profile
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <input className="input-field" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="input-field" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <input className="input-field" placeholder="Photo URL" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="input-field"
                onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-slate-500 text-xs">Pick a photo from your computer or phone gallery. URL still works too.</p>
              <p className="text-slate-500 text-xs">Email cannot be changed here.</p>
              <div className="flex gap-2">
                <button type="button" onClick={handleSave} className="btn-primary text-sm" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                <button type="button" onClick={() => setEditing(false)} className="btn-secondary text-sm">Cancel</button>
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

import { createServerSupabase } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import ProfilePageClient from '@/components/ProfilePageClient';
import ModeAccessBadge from '@/components/ModeAccessBadge';
import { profilePatchFromAuthMetadata } from '@/lib/profile-metadata-sync';

function normalizeNameForMatch(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function compactNameForMatch(s: string | null | undefined): string {
  return normalizeNameForMatch(s).replace(/[^a-z0-9]/g, '');
}

export default async function ProfilesPage() {
  const cookieStore = await cookies();
  const demo = cookieStore.get('pirates_demo')?.value === 'true';
  const isAdminCode = cookieStore.get('pirates_admin')?.value === 'true';
  const modeLabel = isAdminCode ? 'ADMIN: READ & WRITE' : 'VIEWER';

  let profile: {
    name: string | null;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    date_of_birth: string | null;
  } = {
    name: null,
    email: '',
    phone: null,
    avatar_url: null,
    date_of_birth: null,
  };
  let contributionTotal = 0;
  let matchesPlayed = 0;
  let umpiringDuties: { who: string; duty_date: string; notes: string }[] = [];
  let pendingJersey = 0;
  let pendingContribution = 0;
  let playerId: string | null = null;

  if (demo) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--pirate-yellow)' }}>
            My Profile
          </h2>
          <ModeAccessBadge label={modeLabel} />
        </div>
        <div className="card max-w-2xl">
          <p className="text-slate-400">
            You are in demo mode. Log in with an account to see and edit your profile.
          </p>
        </div>
      </div>
    );
  }

  try {
    const supabase = await createServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) redirect('/dashboard');

    profile.email = user.email ?? '';
    type ProfileRowLite = {
      name: string | null;
      avatar_url: string | null;
      phone: string | null;
      date_of_birth: string | null;
    };
    const firstRow = await supabase
      .from('profiles')
      .select('name, avatar_url, phone, date_of_birth')
      .eq('id', user.id)
      .single();
    let profileRow: ProfileRowLite | null = (firstRow.data as ProfileRowLite | null) ?? null;

    // Auto-create profile row if trigger didn't run (e.g. account created before trigger existed)
    if (!profileRow && user) {
      const name = (user as { user_metadata?: { name?: string } }).user_metadata?.name ?? user.email ?? 'User';
      await (supabase as any)
        .from('profiles')
        .upsert(
          { id: user.id, email: user.email ?? '', name, role: 'viewer' },
          { onConflict: 'id' },
        );
      const res = await supabase.from('profiles').select('name, avatar_url, phone, date_of_birth').eq('id', user.id).single();
      profileRow = (res.data as ProfileRowLite | null) ?? null;
    }

    if (profileRow) {
      const r0 = profileRow;
      const patch = profilePatchFromAuthMetadata(
        { name: r0.name, phone: r0.phone, date_of_birth: r0.date_of_birth },
        user.user_metadata as Record<string, unknown>,
      );
      if (patch) {
        const { error: syncErr } = await (supabase as any)
          .from('profiles')
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq('id', user.id);
        if (!syncErr) {
          const res = await (supabase as any)
            .from('profiles')
            .select('name, avatar_url, phone, date_of_birth')
            .eq('id', user.id)
            .single();
          if (res.data) profileRow = res.data as ProfileRowLite;
        }
      }
      const r = profileRow;
      profile.name = r.name;
      profile.avatar_url = r.avatar_url;
      profile.phone = r.phone;
      profile.date_of_birth = r.date_of_birth ?? null;
    }
    if (!profile.name) profile.name = user.email ?? 'User';

    // Linked roster card (profile_id) — exact; auto-create once so Players page shows them
    type Linked = { id: string; photo: string | null; name: string | null };
    let linkedPlayer: Linked | null = null;
    {
      const { data } = await supabase
        .from('players')
        .select('id, photo, name')
        .eq('profile_id', user.id)
        .maybeSingle();
      linkedPlayer = (data as Linked | null) ?? null;
    }

    if (!linkedPlayer) {
      const rosterName = (profile.name ?? '').trim() || 'Player';
      const { data: created, error: createErr } = await (supabase as any)
        .from('players')
        .insert({
          name: rosterName,
          photo: profile.avatar_url,
          profile_id: user.id,
          role: 'Player',
        })
        .select('id, photo, name')
        .single();
      if (!createErr && created) {
        linkedPlayer = created as { id: string; photo: string | null; name: string | null };
      } else if (createErr) {
        const { data: again } = await supabase
          .from('players')
          .select('id, photo, name')
          .eq('profile_id', user.id)
          .maybeSingle();
        if (again) linkedPlayer = again as { id: string; photo: string | null; name: string | null };
      }
    }

    if (linkedPlayer) {
      playerId = linkedPlayer.id;
      if (!profile.avatar_url && linkedPlayer.photo) {
        profile.avatar_url = linkedPlayer.photo;
      }
      const { count } = await supabase
        .from('match_stats')
        .select('*', { count: 'exact', head: true })
        .eq('player_id', linkedPlayer.id);
      matchesPlayed = count ?? 0;
    }

    // Contributions and pending amounts
    const nameVariants = new Set<string>();
    const addVariant = (v: string | null | undefined) => {
      const n = normalizeNameForMatch(v);
      if (n) nameVariants.add(n);
      const c = compactNameForMatch(v);
      if (c) nameVariants.add(c);
    };
    addVariant(profile.name);
    addVariant(linkedPlayer?.name ?? null);

    const nameMatchesSelf = (playerName: string | null | undefined): boolean => {
      const n = normalizeNameForMatch(playerName);
      const c = compactNameForMatch(playerName);
      return (!!n && nameVariants.has(n)) || (!!c && nameVariants.has(c));
    };

    const { data: contribs } = await supabase
      .from('contributions')
      .select('player_name, amount, paid, submitted_by_id');
    const byName = (contribs ?? []).filter(
      (c: { player_name?: string; submitted_by_id?: string | null }) =>
        c.submitted_by_id === user.id || nameMatchesSelf(c.player_name),
    );
    contributionTotal = byName.reduce(
      (s: number, c: { amount: number }) => s + Number(c.amount),
      0,
    );

    const { data: jerseyRows } = await supabase
      .from('jerseys')
      .select('player_name, paid, submitted_by_id');
    const myJerseys = (jerseyRows ?? []).filter(
      (j: { player_name?: string; submitted_by_id?: string | null }) =>
        j.submitted_by_id === user.id ||
        (!j.submitted_by_id && nameMatchesSelf(j.player_name)),
    );
    const unpaidJerseys = myJerseys.filter((j: { paid?: boolean }) => !j.paid);
    pendingJersey = unpaidJerseys.length * 50;

    const unpaidContribs = byName.filter(
      (c: { paid?: boolean }) => !(c as { paid?: boolean }).paid,
    );
    pendingContribution = unpaidContribs.reduce(
      (s: number, c: { amount: number }) => s + Number(c.amount),
      0,
    );

    // Umpiring duties for this player
    try {
      const { data: duties } = await (supabase as any)
        .from('umpiring_duties')
        .select('who, duty_date, notes');
      const all = (duties ?? []) as { who: string; duty_date: string; notes: string }[];
      umpiringDuties = all.filter((d) =>
        (d.who ?? '').toLowerCase().includes((profile.name ?? '').toLowerCase()),
      );
    } catch {
      /* no table */
    }
  } catch {
    redirect('/dashboard');
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--pirate-yellow)' }}>
          My Profile
        </h2>
        <ModeAccessBadge label={modeLabel} />
      </div>
      <ProfilePageClient
        initialProfile={profile}
        contributionTotal={contributionTotal}
        matchesPlayed={matchesPlayed}
        umpiringDuties={umpiringDuties}
        pendingJersey={pendingJersey}
        pendingContribution={pendingContribution}
        playerId={playerId}
      />
    </div>
  );
}

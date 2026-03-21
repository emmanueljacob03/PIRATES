import { createServerSupabase } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import ProfilePageClient from '@/components/ProfilePageClient';

export default async function ProfilesPage() {
  const cookieStore = await cookies();
  const demo = cookieStore.get('pirates_demo')?.value === 'true';

  let profile: { name: string | null; email: string; phone: string | null; avatar_url: string | null } = {
    name: null,
    email: '',
    phone: null,
    avatar_url: null,
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
        <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--pirate-yellow)' }}>
          My Profile
        </h2>
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
    let { data: profileRow } = await supabase
      .from('profiles')
      .select('name, avatar_url, phone')
      .eq('id', user.id)
      .single();

    // Auto-create profile row if trigger didn't run (e.g. account created before trigger existed)
    if (!profileRow && user) {
      const name = (user as { user_metadata?: { name?: string } }).user_metadata?.name ?? user.email ?? 'User';
      await (supabase as any)
        .from('profiles')
        .upsert(
          { id: user.id, email: user.email ?? '', name, role: 'viewer' },
          { onConflict: 'id' },
        );
      const res = await supabase.from('profiles').select('name, avatar_url, phone').eq('id', user.id).single();
      profileRow = res.data;
    }

    if (profileRow) {
      const r = profileRow as { name: string | null; avatar_url: string | null; phone: string | null };
      profile.name = r.name;
      profile.avatar_url = r.avatar_url;
      profile.phone = r.phone;
    }
    if (!profile.name) profile.name = user.email ?? 'User';

    // Linked roster card (profile_id) — exact; auto-create once so Players page shows them
    type Linked = { id: string; photo: string | null };
    let linkedPlayer: Linked | null = null;
    {
      const { data } = await supabase.from('players').select('id, photo').eq('profile_id', user.id).maybeSingle();
      linkedPlayer = (data as Linked | null) ?? null;
    }

    if (!linkedPlayer) {
      const { data: created, error: createErr } = await (supabase as any)
        .from('players')
        .insert({
          name: (profile.name ?? user.email ?? 'Player').trim(),
          photo: profile.avatar_url,
          profile_id: user.id,
          role: 'Player',
        })
        .select('id, photo')
        .single();
      if (!createErr && created) {
        linkedPlayer = created as { id: string; photo: string | null };
      } else if (createErr) {
        const { data: again } = await supabase
          .from('players')
          .select('id, photo')
          .eq('profile_id', user.id)
          .maybeSingle();
        if (again) linkedPlayer = again as { id: string; photo: string | null };
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
    const { data: contribs } = await supabase
      .from('contributions')
      .select('player_name, amount, paid');
    const byName = (contribs ?? []).filter(
      (c: { player_name?: string }) =>
        (c.player_name ?? '').toLowerCase() === (profile.name ?? '').toLowerCase(),
    );
    contributionTotal = byName.reduce(
      (s: number, c: { amount: number }) => s + Number(c.amount),
      0,
    );

    const { data: jerseyRows } = await supabase
      .from('jerseys')
      .select('player_name, paid');
    const myJerseys = (jerseyRows ?? []).filter(
      (j: { player_name?: string }) =>
        (j.player_name ?? '').toLowerCase() === (profile.name ?? '').toLowerCase(),
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
      <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--pirate-yellow)' }}>
        My Profile
      </h2>
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

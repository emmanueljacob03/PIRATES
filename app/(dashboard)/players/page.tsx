import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { playerPhotoUrl, scorecardDisplayName } from '@/lib/player-display-name';
import PlayersGridClient, { type PlayersGridPlayer } from '@/components/PlayersGridClient';

export default async function PlayersPage() {
  const cookieStore = await cookies();
  const demo = cookieStore.get('pirates_demo')?.value === 'true';
  const isAdminCode = cookieStore.get('pirates_admin')?.value === 'true';
  type PlayerRow = {
    id: string;
    name: string;
    photo: string | null;
    jersey_number: number | null;
    role: string;
    profile_id?: string | null;
    updated_at?: string;
  };
  let players: PlayersGridPlayer[] = [];
  let canEdit = false;
  let canDeletePlayers = false;

  try {
    const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';
    let fetchedPlayers: PlayerRow[] = [];

    if (codeVerified) {
      const supabase = createAdminSupabase();
      const { data } = await supabase.from('players').select('*').order('name');
      fetchedPlayers = (data ?? []) as PlayerRow[];
      const s2 = await createServerSupabase();
      const {
        data: { user: u2 },
      } = await s2.auth.getUser();
      if (u2) {
        const { data: pr2 } = await s2.from('profiles').select('role').eq('id', u2.id).maybeSingle();
        canDeletePlayers = isAdminCode || (pr2 as { role?: string } | null)?.role === 'admin';
      } else {
        canDeletePlayers = isAdminCode;
      }
    } else {
      const supabase = await createServerSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profileRow } = user ? await supabase.from('profiles').select('role').eq('id', user.id).single() : { data: null };
      const profile = profileRow as { role: string } | null;
      canEdit = isAdminCode || profile?.role === 'admin' || profile?.role === 'editor';
      canDeletePlayers = isAdminCode || profile?.role === 'admin';

      const { data } = await supabase.from('players').select('*').order('name');
      fetchedPlayers = (data ?? []) as PlayerRow[];
    }

    const profileIds = Array.from(
      new Set(
        fetchedPlayers.map((p) => p.profile_id).filter((id): id is string => Boolean(id)),
      ),
    );
    const profileById = new Map<string, { name: string | null; avatar_url: string | null }>();
    if (profileIds.length > 0) {
      const sb = codeVerified ? createAdminSupabase() : await createServerSupabase();
      const { data: profs } = await sb.from('profiles').select('id, name, avatar_url').in('id', profileIds);
      for (const row of profs ?? []) {
        const r = row as { id: string; name: string | null; avatar_url: string | null };
        profileById.set(r.id, { name: r.name, avatar_url: r.avatar_url });
      }
    }

    players = fetchedPlayers.map((p) => {
      const pr = p.profile_id ? profileById.get(p.profile_id) : undefined;
      const displayName = scorecardDisplayName(p.name, pr?.name ?? null, p.profile_id ?? null);
      const displayPhoto = playerPhotoUrl(p.photo, pr?.avatar_url ?? null);
      return {
        id: p.id,
        displayName,
        displayPhoto,
        jersey_number: p.jersey_number,
        role: p.role,
        updated_at: p.updated_at,
      };
    });
  } catch {
    players = [];
  }

  const canEditPhoto = !demo && (isAdminCode || canEdit);

  return (
    <div>
      <h2 className="text-2xl font-bold text-pirate-gold mb-6">Players</h2>
      {players.length > 0 ? (
        <PlayersGridClient
          players={players}
          demo={demo}
          canEditPhoto={canEditPhoto}
          canDeletePlayers={!demo && canDeletePlayers}
        />
      ) : (
        <p className="text-slate-500">No players added yet.</p>
      )}
    </div>
  );
}

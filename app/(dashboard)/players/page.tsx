import Image from 'next/image';
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import PlayerPhotoUpload from '@/components/PlayerPhotoUpload';
import DeletePlayerButton from '@/components/DeletePlayerButton';

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
  type DisplayPlayer = PlayerRow & { displayName: string; displayPhoto: string | null };
  let players: DisplayPlayer[] = [];
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
      const registered = pr?.name?.trim() || '';
      const rawPlayerName = p.name?.trim() || '';
      const looksLikeEmail = rawPlayerName.includes('@');
      const displayName = registered || (!looksLikeEmail ? rawPlayerName : '') || 'Player';
      const displayPhoto = (p.photo?.trim() || pr?.avatar_url?.trim() || null) as string | null;
      return { ...p, displayName, displayPhoto };
    });
  } catch {
    players = [];
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-pirate-gold mb-6">Players</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {players.map((p) => {
          const imgSrc =
            p.displayPhoto &&
            `${p.displayPhoto}${p.displayPhoto.includes('?') ? '&' : '?'}v=${encodeURIComponent(p.updated_at ?? p.id)}`;
          const content = (
            <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-800">
              {p.displayPhoto && imgSrc ? (
                <Image
                  key={imgSrc}
                  src={imgSrc}
                  alt={p.displayName}
                  fill
                  className="object-cover"
                  sizes="220px"
                  unoptimized
                />
              ) : (
                <PlayerPhotoUpload playerId={p.id} playerName={p.displayName} />
              )}
              {!demo && (isAdminCode || canEdit) && p.displayPhoto && (
                <div className="absolute top-2 right-2 z-30">
                  <PlayerPhotoUpload playerId={p.id} playerName={p.displayName} compact />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-black/10 px-3 py-2 flex items-center gap-2">
                <p className="font-semibold text-xs sm:text-sm text-white truncate min-w-0 flex-1">{p.displayName}</p>
              </div>
            </div>
          );
          return (
            <div key={p.id} className="card p-2 hover:border-amber-500/40 transition relative">
              {!demo && canDeletePlayers && (
                <DeletePlayerButton playerId={p.id} playerName={p.displayName} />
              )}
              {content}
            </div>
          );
        })}
      </div>
      {players.length === 0 && <p className="text-slate-500">No players added yet.</p>}
    </div>
  );
}

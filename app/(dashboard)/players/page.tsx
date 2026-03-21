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
  let players: { id: string; name: string; photo: string | null; jersey_number: number | null; role: string }[] = [];
  let canEdit = false;
  let canDeletePlayers = false;

  try {
    const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';
    let fetchedPlayers: { id: string; name: string; photo: string | null; jersey_number: number | null; role: string }[] = [];

    if (codeVerified) {
      const supabase = createAdminSupabase();
      const { data } = await supabase.from('players').select('*').order('name');
      fetchedPlayers = (data ?? []) as typeof fetchedPlayers;
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
      fetchedPlayers = (data ?? []) as typeof fetchedPlayers;
    }

    players = fetchedPlayers;
  } catch {
    players = [];
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-pirate-gold mb-6">Players</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {players.map((p) => {
          const content = (
            <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-800">
              {p.photo ? (
                <Image src={p.photo} alt={p.name} fill className="object-cover" sizes="220px" />
              ) : (
                <PlayerPhotoUpload playerId={p.id} playerName={p.name} />
              )}
              {!demo && (isAdminCode || canEdit) && p.photo && (
                <div className="absolute top-2 right-2 z-10">
                  <PlayerPhotoUpload playerId={p.id} playerName={p.name} compact />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-black/10 px-3 py-2 flex items-center gap-2">
                <p className="font-semibold text-xs sm:text-sm text-white truncate min-w-0 flex-1">{p.name}</p>
              </div>
            </div>
          );
          return (
            <div key={p.id} className="card p-2 hover:border-amber-500/40 transition relative">
              {!demo && canDeletePlayers && <DeletePlayerButton playerId={p.id} playerName={p.name} />}
              {content}
            </div>
          );
        })}
      </div>
      {players.length === 0 && <p className="text-slate-500">No players added yet.</p>}
    </div>
  );
}

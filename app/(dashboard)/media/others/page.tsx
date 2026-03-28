import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import TeamOthersMediaClient from '@/components/TeamOthersMediaClient';

export const dynamic = 'force-dynamic';

export default async function TeamOthersMediaPage() {
  const cookieStore = await cookies();
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';
  const canUpload = cookieStore.get('pirates_code_verified')?.value === 'true';

  let photos: { id: string; url: string }[] = [];
  let videos: { id: string; url: string }[] = [];

  try {
    const supabase = codeVerified ? createAdminSupabase() : await createServerSupabase();
    const { data: media, error } = await supabase
      .from('match_media')
      .select('id, type, url')
      .is('match_id', null)
      .in('type', ['photo', 'video'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = (media ?? []) as { id: string; type: string; url: string }[];
    photos = rows.filter((r) => r.type === 'photo').map(({ id, url }) => ({ id, url }));
    videos = rows.filter((r) => r.type === 'video').map(({ id, url }) => ({ id, url }));
  } catch {
    photos = [];
    videos = [];
  }

  return (
    <div>
      <Link href="/media" className="text-amber-400 hover:underline text-sm mb-4 inline-block">
        ← Back to Match Media
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-bold text-pirate-gold">Others</h2>
          <p className="text-slate-400 mt-1">
            Team folder for leftover photos & videos (not linked to a match). No limit.
          </p>
        </div>
        <Link
          href="/media/all"
          className="shrink-0 text-sm font-semibold text-amber-400 hover:text-amber-300 hover:underline px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10"
        >
          View all
        </Link>
      </div>

      <TeamOthersMediaClient canUpload={canUpload} />

      <h3 className="text-lg font-semibold text-white mb-3">Photos ({photos.length})</h3>
      <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-8 gap-1 mb-10">
        {photos.length === 0 ? (
          <p className="text-slate-500 col-span-full">No photos yet.</p>
        ) : (
          photos.map((m) => (
            <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="group block">
              <div className="aspect-square rounded-sm overflow-hidden bg-slate-700 border border-slate-600 group-hover:border-amber-400 transition">
                <img src={m.url} alt="" className="w-full h-full object-cover scale-85" />
              </div>
            </a>
          ))
        )}
      </div>

      <h3 className="text-lg font-semibold text-white mb-3">Videos ({videos.length})</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2">
        {videos.length === 0 ? (
          <p className="text-slate-500 col-span-full">No videos yet.</p>
        ) : (
          videos.map((m) => (
            <a
              key={m.id}
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <div className="relative aspect-square rounded-sm overflow-hidden bg-slate-700 border border-slate-600 group-hover:border-amber-400 transition">
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-[1]">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/60 text-white">
                    ▶
                  </span>
                </div>
                <video src={m.url} className="w-full h-full object-cover scale-85" muted playsInline />
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}

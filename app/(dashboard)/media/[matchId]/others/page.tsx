import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { format, parseISO, addHours, isAfter } from 'date-fns';

function isPracticeMatch(match: { opponent: string }) {
  return (match.opponent || '').toLowerCase().includes('practice');
}

function isMediaReady(match: { date: string; time: string; opponent: string }) {
  if (isPracticeMatch(match)) return false;
  const datePart = match.date.slice(0, 10);
  const timePart = (match.time || '00:00').slice(0, 5);
  const matchDate = new Date(`${datePart}T${timePart}:00`);
  return isAfter(new Date(), addHours(matchDate, 6));
}

export const dynamic = 'force-dynamic';

export default async function MatchOthersAlbumPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const cookieStore = await cookies();
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';

  try {
    const supabase = codeVerified ? createAdminSupabase() : await createServerSupabase();
    const { data: matchRow } = await supabase.from('matches').select('*').eq('id', matchId).single();
    if (!matchRow) notFound();
    if (!isMediaReady(matchRow as { date: string; time: string; opponent: string })) notFound();

    const { data: media } = await supabase
      .from('match_media')
      .select('id, type, url')
      .eq('match_id', matchId)
      .eq('album', 'others')
      .in('type', ['photo', 'video'])
      .order('created_at', { ascending: false });

    const items = (media ?? []) as { id: string; type: string; url: string }[];
    const photos = items.filter((m) => m.type === 'photo');
    const videos = items.filter((m) => m.type === 'video');
    const matchDate = parseISO((matchRow as { date: string }).date.slice(0, 10));

    return (
      <div>
        <Link href={`/media/${matchId}`} className="text-amber-400 hover:underline text-sm mb-4 inline-block">
          ← Back to Match
        </Link>
        <h2 className="text-2xl font-bold text-pirate-gold mb-2">{format(matchDate, 'MMMM d')} — Others</h2>
        <p className="text-slate-400 mb-6">All photos and videos in the Others album for this match.</p>

        <h3 className="text-lg font-semibold text-white mb-3">Photos ({photos.length})</h3>
        <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-8 gap-1 mb-10">
          {photos.length === 0 ? (
            <p className="text-slate-500 col-span-full">No photos in Others yet.</p>
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
            <p className="text-slate-500 col-span-full">No videos in Others yet.</p>
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
  } catch {
    notFound();
  }
}

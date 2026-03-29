import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { format, parseISO, addHours, isAfter } from 'date-fns';
import MatchMediaClient from '@/components/MatchMediaClient';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { mediaAlbum } from '@/lib/match-media-shared';

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

export default async function MatchMediaDetailPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const cookieStore = await cookies();
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';
  const canUpload = codeVerified;
  let match: { id: string; date: string; time?: string | null; opponent: string } | null = null;
  let mediaList: { id: string; type: string; url: string; title: string | null; album?: string | null }[] = [];

  try {
    const supabase = codeVerified ? createAdminSupabase() : await createServerSupabase();
    const { data: matchRow } = await supabase.from('matches').select('*').eq('id', matchId).single();
    if (!matchRow) notFound();
    match = matchRow as { id: string; date: string; time?: string | null; opponent: string };
    if (!isMediaReady({ date: match.date, time: match.time ?? '00:00', opponent: match.opponent })) notFound();

    const { data: media } = await supabase.from('match_media').select('*').eq('match_id', matchId).order('created_at', { ascending: false });
    mediaList = (media ?? []) as { id: string; type: string; url: string; title: string | null }[];
  } catch {
    notFound();
  }

  if (!match) notFound();

  const matchDate = parseISO(match.date.slice(0, 10));

  const photos = mediaList.filter((m) => m.type === 'photo' && mediaAlbum(m) === 'main');
  const videos = mediaList.filter((m) => m.type === 'video' && mediaAlbum(m) === 'main');

  return (
    <div>
      <Link href="/media" className="text-amber-400 hover:underline text-sm mb-4 inline-block">
        ← Back to Match Media
      </Link>
      <div className="mb-2">
        <h2 className="text-2xl font-bold text-pirate-gold">{format(matchDate, 'MMMM d')} Match</h2>
        <p className="text-slate-400 mt-1">vs {match.opponent}</p>
      </div>
      <p className="text-slate-500 text-sm mb-6">
        Photos and videos for this match. Use the team{' '}
        <Link href="/media/others" className="text-amber-400 hover:underline">
          Others
        </Link>{' '}
        folder for extra media. Open <Link href="/media" className="text-amber-400 hover:underline">Match Media</Link> and use
        View all there to see every file.
      </p>
      <MatchMediaClient matchId={matchId} canUpload={canUpload} />
      <div className="grid md:grid-cols-2 gap-6 mt-8">
        <section className="card">
          <div className="w-full flex items-center justify-between text-left mb-4">
            <h3 className="text-lg font-semibold">
              Photos <span className="text-amber-400">({photos.length})</span>
            </h3>
            <Link href={`/media/${matchId}/photos`} className="text-xs text-amber-400 hover:underline">
              Open album
            </Link>
          </div>
          <p className="text-slate-500 text-sm">Match photos (no limit).</p>
        </section>
        <section className="card">
          <div className="w-full flex items-center justify-between text-left mb-4">
            <h3 className="text-lg font-semibold">
              Videos <span className="text-amber-400">({videos.length})</span>
            </h3>
            <Link href={`/media/${matchId}/videos`} className="text-xs text-amber-400 hover:underline">
              Open album
            </Link>
          </div>
          <p className="text-slate-500 text-sm">Match videos (no limit).</p>
        </section>
      </div>
    </div>
  );
}

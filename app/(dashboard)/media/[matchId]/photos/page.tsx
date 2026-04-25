import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { format, parseISO, addHours, isAfter } from 'date-fns';
import MediaPhotoGallery from '@/components/MediaPhotoGallery';

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

export default async function MatchPhotosPage({ params }: { params: Promise<{ matchId: string }> }) {
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
      .eq('type', 'photo')
      .eq('album', 'main')
      .order('created_at', { ascending: false });

    const photos = (media ?? []) as { id: string; url: string }[];
    const matchDate = parseISO((matchRow as { date: string }).date.slice(0, 10));

    return (
      <div>
        <Link href={`/media/${matchId}`} className="text-amber-400 hover:underline text-sm mb-4 inline-block">
          ← Back to Match
        </Link>
        <h2 className="text-2xl font-bold text-pirate-gold mb-2">{format(matchDate, 'MMMM d')} Photos</h2>
        <p className="text-slate-400 mb-6">Tap to open full screen. Use arrows to move next/previous.</p>
        <MediaPhotoGallery photos={photos} canDelete={codeVerified} />
      </div>
    );
  } catch {
    notFound();
  }
}

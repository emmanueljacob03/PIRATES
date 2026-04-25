import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { format, parseISO, addHours, isAfter } from 'date-fns';
import { mediaAlbum } from '@/lib/match-media-shared';
import MediaPhotoGallery from '@/components/MediaPhotoGallery';

function isPracticeMatch(match: { opponent: string }) {
  return (match.opponent || '').toLowerCase().includes('practice');
}

function isMediaReady(match: { date: string; time?: string | null; opponent: string }) {
  if (isPracticeMatch(match)) return false;
  const datePart = match.date.slice(0, 10);
  const timePart = (match.time || '00:00').slice(0, 5);
  const matchDate = new Date(`${datePart}T${timePart}:00`);
  return isAfter(new Date(), addHours(matchDate, 6));
}

export const dynamic = 'force-dynamic';

type MediaRow = {
  id: string;
  match_id: string | null;
  type: string;
  url: string;
  album?: string | null;
  created_at: string;
};

export default async function MediaAllPage() {
  const cookieStore = await cookies();
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';

  let photos: { row: MediaRow; label: string }[] = [];
  let videos: { row: MediaRow; label: string }[] = [];

  try {
    const supabase = codeVerified ? createAdminSupabase() : await createServerSupabase();
    const { data: mediaRows, error: mediaErr } = await supabase
      .from('match_media')
      .select('id, match_id, type, url, album, created_at')
      .in('type', ['photo', 'video'])
      .order('created_at', { ascending: false });

    if (mediaErr) throw mediaErr;

    const { data: matchesData } = await supabase.from('matches').select('id, date, time, opponent');
    const matches = (matchesData ?? []) as {
      id: string;
      date: string;
      time?: string | null;
      opponent: string;
    }[];
    const readyIds = new Set(matches.filter((m) => isMediaReady(m)).map((m) => m.id));
    const matchById = Object.fromEntries(matches.map((m) => [m.id, m]));

    const rows = (mediaRows ?? []) as MediaRow[];
    const filtered = rows.filter(
      (r) => r.match_id == null || readyIds.has(r.match_id),
    );

    const buildLabel = (r: MediaRow) => {
      if (r.match_id == null) return 'Team · Others folder';
      const m = matchById[r.match_id];
      if (!m) return 'Unknown match';
      const d = parseISO(m.date.slice(0, 10));
      const folder = mediaAlbum(r) === 'others' ? 'Others' : 'Main';
      return `${format(d, 'MMM d')} vs ${m.opponent} · ${folder}`;
    };

    for (const r of filtered) {
      const label = buildLabel(r);
      if (r.type === 'photo') photos.push({ row: r, label });
      else if (r.type === 'video') videos.push({ row: r, label });
    }
  } catch {
    photos = [];
    videos = [];
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <Link href="/media" className="text-amber-400 hover:underline text-sm mb-2 inline-block">
            ← Back to Match Media
          </Link>
          <h2 className="text-2xl font-bold text-pirate-gold">View all</h2>
          <p className="text-slate-400 mt-1">
            Every photo and video: all matches (main + per-match others) and the team Others folder.
          </p>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-white mb-3">All photos ({photos.length})</h3>
      <div className="mb-10">
        <MediaPhotoGallery
          photos={photos.map(({ row, label }) => ({ id: row.id, url: row.url, label }))}
          canDelete={codeVerified}
        />
      </div>

      <h3 className="text-lg font-semibold text-white mb-3">All videos ({videos.length})</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2">
        {videos.length === 0 ? (
          <p className="text-slate-500 col-span-full">No videos yet.</p>
        ) : (
          videos.map(({ row, label }) => (
            <a
              key={row.id}
              href={row.url}
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
                <video src={row.url} className="w-full h-full object-cover scale-85" muted playsInline />
              </div>
              <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-tight">{label}</p>
            </a>
          ))
        )}
      </div>
    </div>
  );
}

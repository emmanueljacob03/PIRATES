import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import { format, parseISO, isAfter, addHours } from 'date-fns';

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

export default async function MediaPage() {
  const cookieStore = await cookies();
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';
  let matches: { id: string; date: string; time?: string | null; opponent: string }[] = [];
  try {
    const supabase = codeVerified ? createAdminSupabase() : await createServerSupabase();
    const { data } = await supabase.from('matches').select('id, date, time, opponent').order('date', { ascending: false });
    matches = (data ?? []) as { id: string; date: string; time?: string | null; opponent: string }[];
  } catch {
    matches = [];
  }

  const visibleMatches = matches.filter(isMediaReady);

  const grouped = visibleMatches.reduce<Record<string, { date: string; matches: { id: string; date: string; opponent: string }[] }>>((acc, m) => {
    const folder = m.date.slice(0, 10);
    if (!acc[folder]) acc[folder] = { date: folder, matches: [] };
    acc[folder].matches.push(m);
    return acc;
  }, {});
  const folders = Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-pirate-gold">Match Media</h2>
          <p className="text-slate-400 mt-2">Select a match folder to view or upload photos and videos.</p>
        </div>
        <Link
          href="/media/all"
          className="shrink-0 text-sm font-semibold text-amber-400 hover:text-amber-300 hover:underline px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 self-start"
        >
          View all
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {folders.map((folder) => (
          <div key={folder.date} className="card p-3">
            <p className="text-sm text-slate-400 mb-3">Match folder: {format(parseISO(folder.date), 'MMMM d, yyyy')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {folder.matches.map((m) => (
                <Link
                  key={m.id}
                  href={`/media/${m.id}`}
                  className="card block p-2.5 hover:border-amber-500/50 transition"
                >
                  <p className="font-semibold text-white">{format(parseISO(m.date.slice(0, 10)), 'MMMM d')} Match</p>
                  <p className="text-slate-400 text-sm">vs {m.opponent}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      {visibleMatches.length === 0 && (
        <p className="text-slate-500">No matches yet. Add a match in Schedule first.</p>
      )}
    </div>
  );
}

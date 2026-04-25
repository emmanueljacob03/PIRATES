import { createAdminSupabase } from '@/lib/supabase-admin';
import { toLiveEmbedUrl } from '@/lib/live-stream-embed';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Live — Pirates Cricket',
  description: 'Watch the live stream',
};

export default async function PublicWatchPage() {
  let title: string | null = null;
  let embedUrl: string | null = null;
  let active = false;
  try {
    const supabase = createAdminSupabase() as any;
    const { data } = await supabase
      .from('team_chat_settings')
      .select('live_stream_url, live_stream_active, live_stream_title')
      .eq('id', 1)
      .maybeSingle();
    const row = data as {
      live_stream_url?: string | null;
      live_stream_active?: boolean;
      live_stream_title?: string | null;
    } | null;
    if (row) {
      active = Boolean(row.live_stream_active);
      title = row.live_stream_title?.trim() || null;
      const url = row.live_stream_url?.trim() || null;
      embedUrl = active && url ? toLiveEmbedUrl(url) : null;
    }
  } catch {
    /* DB not ready */
  }

  return (
    <div className="min-h-screen bg-pirate-dark flex flex-col">
      <header className="border-b border-slate-700 px-4 py-3 flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-amber-400">Pirates — live</h1>
        {title ? <p className="text-slate-300 text-sm truncate text-right flex-1">{title}</p> : null}
      </header>
      <main className="flex-1 flex flex-col p-3 sm:p-4 max-w-5xl mx-auto w-full">
        {!active || !embedUrl ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-400 text-center px-4">The stream is not live right now.</p>
          </div>
        ) : (
          <div className="relative w-full flex-1 min-h-[50vh] sm:min-h-0 sm:aspect-video bg-black rounded-lg overflow-hidden border border-slate-600">
            <iframe
              title="Live stream"
              src={embedUrl}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        )}
      </main>
    </div>
  );
}

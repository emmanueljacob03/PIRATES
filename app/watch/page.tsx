import { createAdminSupabase } from '@/lib/supabase-admin';
import { toLiveEmbedUrl } from '@/lib/live-stream-embed';
import PublicLiveWatchLayout from '@/components/PublicLiveWatchLayout';

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
        <PublicLiveWatchLayout active={active} embedUrl={embedUrl} />
      </main>
    </div>
  );
}

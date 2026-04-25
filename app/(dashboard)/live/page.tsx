import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { toLiveEmbedUrl } from '@/lib/live-stream-embed';
import LiveStreamPageClient from '@/components/LiveStreamPageClient';

export const dynamic = 'force-dynamic';

export default async function LivePage() {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('pirates_admin')?.value === 'true';

  let initial = { url: null as string | null, active: false, title: null as string | null, embedUrl: null as string | null };
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
      const url = row.live_stream_url?.trim() || null;
      const active = Boolean(row.live_stream_active);
      const title = row.live_stream_title?.trim() || null;
      const embedUrl = active && url ? toLiveEmbedUrl(url) : null;
      initial = { url, active, title, embedUrl };
    }
  } catch {
    /* missing columns until migration */
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-pirate-gold mb-2">Live Stream</h2>
      <p className="text-slate-400 mb-6">
        Admins: start the stream from this page (YouTube or Vimeo link + <span className="text-slate-300">Start stream</span>) so
        the team and the public <code className="text-amber-200/80 text-xs">/watch</code> page can view.
      </p>
      <LiveStreamPageClient isAdmin={isAdmin} initial={initial} />
    </div>
  );
}

import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { toLiveEmbedUrl } from '@/lib/live-stream-embed';
import LiveStreamPageClient from '@/components/LiveStreamPageClient';

export const dynamic = 'force-dynamic';

export default async function LivePage() {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('pirates_admin')?.value === 'true';

  let initial: {
    url: string | null;
    active: boolean;
    title: string | null;
    embedUrl: string | null;
    startedAt?: string | null;
    history?: {
      id: string;
      url: string;
      label: string | null;
      started_at: string | null;
      ended_at: string;
      created_at: string;
    }[];
  } = { url: null, active: false, title: null, embedUrl: null };
  try {
    const supabase = createAdminSupabase() as any;
    const [{ data }, { data: history }] = await Promise.all([
      supabase
        .from('team_chat_settings')
        .select('live_stream_url, live_stream_active, live_stream_title, updated_at')
        .eq('id', 1)
        .maybeSingle(),
      supabase
        .from('live_stream_history')
        .select('id, url, label, started_at, ended_at, created_at')
        .order('ended_at', { ascending: false })
        .limit(50),
    ]);
    const row = data as {
      live_stream_url?: string | null;
      live_stream_active?: boolean;
      live_stream_title?: string | null;
      updated_at?: string;
    } | null;
    if (row) {
      const url = row.live_stream_url?.trim() || null;
      const active = Boolean(row.live_stream_active);
      const title = row.live_stream_title?.trim() || null;
      const embedUrl = active && url ? toLiveEmbedUrl(url) : null;
      initial = {
        url,
        active,
        title,
        embedUrl,
        startedAt: active ? row.updated_at ?? null : null,
        history: history ?? [],
      };
    }
  } catch {
    /* missing columns until migration */
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-pirate-gold mb-2">Live Stream</h2>
      <p className="text-slate-400 mb-6">
        Admin will start during the match.
      </p>
      <LiveStreamPageClient isAdmin={isAdmin} initial={initial} />
    </div>
  );
}

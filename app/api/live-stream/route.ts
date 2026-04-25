import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { toLiveEmbedUrl } from '@/lib/live-stream-embed';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminSupabase() as any;
    const { data, error } = await supabase
      .from('team_chat_settings')
      .select('live_stream_url, live_stream_active, live_stream_title')
      .eq('id', 1)
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        { url: null, active: false, title: null, embedUrl: null },
        { status: 200 },
      );
    }
    const row = data as {
      live_stream_url?: string | null;
      live_stream_active?: boolean;
      live_stream_title?: string | null;
    } | null;
    const url = row?.live_stream_url?.trim() || null;
    const active = Boolean(row?.live_stream_active);
    const title = row?.live_stream_title?.trim() || null;
    const embedUrl = active && url ? toLiveEmbedUrl(url) : null;
    return NextResponse.json({ url, active, title, embedUrl });
  } catch {
    return NextResponse.json(
      { url: null, active: false, title: null, embedUrl: null },
      { status: 200 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_admin')?.value !== 'true') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  let body: { url?: string; active?: boolean; title?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const url =
    body.url === null
      ? null
      : typeof body.url === 'string'
        ? body.url.trim()
        : undefined;
  const title =
    body.title === null
      ? null
      : typeof body.title === 'string'
        ? body.title.trim()
        : undefined;
  const active = typeof body.active === 'boolean' ? body.active : undefined;
  if (url != null && url !== '' && !toLiveEmbedUrl(url)) {
    return NextResponse.json(
      { error: 'Use a YouTube or Vimeo live / watch URL we can embed.' },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (url !== undefined) updates.live_stream_url = url;
  if (title !== undefined) updates.live_stream_title = title;
  if (active !== undefined) updates.live_stream_active = active;

  if (Object.keys(updates).length === 1 && updates.updated_at) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const supabase = createAdminSupabase() as any;
    const { data, error } = await supabase
      .from('team_chat_settings')
      .update(updates)
      .eq('id', 1)
      .select('live_stream_url, live_stream_active, live_stream_title')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const row = data as {
      live_stream_url?: string | null;
      live_stream_active?: boolean;
      live_stream_title?: string | null;
    };
    const u = row?.live_stream_url?.trim() || null;
    const a = Boolean(row?.live_stream_active);
    const t = row?.live_stream_title?.trim() || null;
    const embedUrl = a && u ? toLiveEmbedUrl(u) : null;
    try {
      revalidatePath('/live');
      revalidatePath('/watch');
    } catch {
      /* ignore */
    }
    return NextResponse.json({ url: u, active: a, title: t, embedUrl });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_code_verified')?.value !== 'true') {
    return NextResponse.json({ error: 'Enter the team code to upload media.' }, { status: 403 });
  }

  const userClient = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to upload media.' }, { status: 401 });
  }

  try {
    const supabase = createAdminSupabase();
    const table = (supabase as any).from('match_media');
    async function insertMediaRow(insertPayload: Record<string, unknown>, teamOthers: boolean) {
      let inserted: unknown = null;
      let insertError: { message?: string } | null = null;

      {
        const res = await table.insert(insertPayload).select().single();
        inserted = res.data;
        insertError = res.error;
      }

      // Backward compatibility for DBs that don't have the album column yet.
      if (
        insertError?.message?.toLowerCase().includes('column') &&
        insertError.message.toLowerCase().includes('album')
      ) {
        const fallbackPayload = { ...insertPayload };
        delete (fallbackPayload as { album?: string }).album;
        const res = await table.insert(fallbackPayload).select().single();
        inserted = res.data;
        insertError = res.error;
      }

      if (insertError) {
        const msg = insertError.message ?? 'Insert failed';
        if (teamOthers && msg.toLowerCase().includes('null value') && msg.toLowerCase().includes('match_id')) {
          return NextResponse.json(
            {
              error:
                'Team Others requires match_media.match_id to allow NULL. Run supabase/alter_match_media_null_match_for_team_others.sql in Supabase SQL Editor.',
            },
            { status: 400 },
          );
        }
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      return NextResponse.json(inserted);
    }

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = (await req.json()) as {
        match_id?: string;
        team_others?: boolean;
        type?: 'photo' | 'video';
        album?: string;
        url?: string;
      };
      const match_id = String(body.match_id || '').trim();
      const teamOthers = body.team_others === true;
      const type = body.type;
      const album = body.album === 'others' ? 'others' : 'main';
      const url = String(body.url || '').trim();
      if (!type || !['photo', 'video'].includes(type) || !/^https?:\/\//i.test(url)) {
        return NextResponse.json({ error: 'type and valid url are required' }, { status: 400 });
      }
      if (!teamOthers && !match_id) {
        return NextResponse.json({ error: 'match_id is required unless uploading to team Others' }, { status: 400 });
      }
      return await insertMediaRow(
        {
          match_id: teamOthers ? null : match_id,
          type,
          url,
          title: null,
          album: teamOthers ? 'others' : album,
        },
        teamOthers,
      );
    }

    const formData = await req.formData();
    const match_id = String(formData.get('match_id') || '').trim();
    const teamOthers = formData.get('team_others') === 'true';
    const type = String(formData.get('type') || '').trim() as 'photo' | 'video';
    const albumRaw = String(formData.get('album') || 'main').trim();
    const album = albumRaw === 'others' ? 'others' : 'main';
    const file = formData.get('file');
    if (!file || !(file instanceof File) || !['photo', 'video'].includes(type)) {
      return NextResponse.json({ error: 'type and file are required' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || (type === 'video' ? 'mp4' : 'jpg');
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || (type === 'video' ? 'mp4' : 'jpg');
    let path: string;
    let insertPayload: Record<string, unknown>;
    if (teamOthers) {
      path = `team-media-others/${type}-${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
      insertPayload = { match_id: null, type, url: '', title: null, album: 'others' };
    } else {
      if (!match_id) {
        return NextResponse.json({ error: 'match_id is required unless uploading to team Others' }, { status: 400 });
      }
      path = `match-media/${match_id}/${album}/${type}-${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
      insertPayload = { match_id, type, url: '', title: null, album };
    }

    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
      upsert: true,
      contentType: file.type || (type === 'video' ? 'video/mp4' : 'image/jpeg'),
    });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    insertPayload.url = data.publicUrl;
    return await insertMediaRow(insertPayload, teamOthers);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'Server needs SUPABASE_SERVICE_ROLE_KEY in .env.local to upload media.' }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_admin')?.value !== 'true') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
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
    const supabase = createAdminSupabase();

    let path: string;
    let insertPayload: Record<string, unknown>;

    if (teamOthers) {
      path = `team-media-others/${type}-${Date.now()}.${ext}`;
      insertPayload = {
        match_id: null,
        type,
        url: '',
        title: null,
        album: 'others',
      };
    } else {
      if (!match_id) {
        return NextResponse.json({ error: 'match_id is required unless uploading to team Others' }, { status: 400 });
      }
      path = `match-media/${match_id}/${album}/${type}-${Date.now()}.${ext}`;
      insertPayload = {
        match_id,
        type,
        url: '',
        title: null,
        album,
      };
    }

    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    insertPayload.url = data.publicUrl;

    const { data: inserted, error: insertError } = await (supabase as any)
      .from('match_media')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
    return NextResponse.json(inserted);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'Server needs SUPABASE_SERVICE_ROLE_KEY in .env.local to upload media.' }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

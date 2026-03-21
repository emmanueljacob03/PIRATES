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
    const type = String(formData.get('type') || '').trim() as 'photo' | 'video';
    const file = formData.get('file');
    if (!match_id || !file || !(file instanceof File) || !['photo', 'video'].includes(type)) {
      return NextResponse.json({ error: 'match_id, type, and file are required' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || (type === 'video' ? 'mp4' : 'jpg');
    const path = `match-media/${match_id}/${type}-${Date.now()}.${ext}`;
    const supabase = createAdminSupabase();

    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const { data: inserted, error: insertError } = await (supabase as any).from('match_media').insert({
      match_id,
      type,
      url: data.publicUrl,
      title: null,
    }).select().single();

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

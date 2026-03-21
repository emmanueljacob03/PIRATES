import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('pirates_admin')?.value === 'true';
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  }

  const formData = await req.formData();
  const playerId = String(formData.get('player_id') ?? '').trim();
  const file = formData.get('file');
  const ext = String(formData.get('ext') ?? 'png').trim() || 'png';

  if (!playerId || !(file instanceof File)) {
    return NextResponse.json({ error: 'player_id and file are required' }, { status: 400 });
  }

  try {
    const supabase = createAdminSupabase();
    const path = `${playerId}/photo-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const { error: updateError } = await (supabase as any)
      .from('players')
      .update({ photo: data.publicUrl })
      .eq('id', playerId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    return NextResponse.json({ ok: true, photo: data.publicUrl });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

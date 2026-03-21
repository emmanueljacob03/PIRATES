import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const playerId = String(formData.get('player_id') ?? '').trim();
  const file = formData.get('file');
  const ext = String(formData.get('ext') ?? 'png').trim() || 'png';

  if (!playerId || !(file instanceof File)) {
    return NextResponse.json({ error: 'player_id and file are required' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const adminCookie = cookieStore.get('pirates_admin')?.value === 'true';

  const userSupabase = await createServerSupabase();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  // Team code admin cookie works without a Supabase session (same as delete-player API)
  if (!adminCookie && !user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  let allowed = adminCookie;
  if (!allowed && user) {
    const { data: pr } = await userSupabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const role = (pr as { role?: string } | null)?.role;
    if (role === 'admin' || role === 'editor') allowed = true;
  }
  if (!allowed && user) {
    const { data: row } = await userSupabase.from('players').select('profile_id').eq('id', playerId).maybeSingle();
    const pid = (row as { profile_id?: string | null } | null)?.profile_id;
    if (pid === user.id) allowed = true;
  }
  if (!allowed) {
    return NextResponse.json({ error: 'Not allowed to update this player photo' }, { status: 403 });
  }

  try {
    const supabase = createAdminSupabase();
    const path = `${playerId}/photo-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = data.publicUrl;
    const { error: updateError } = await (supabase as any)
      .from('players')
      .update({ photo: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', playerId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

    const { data: playerRow } = await supabase.from('players').select('profile_id').eq('id', playerId).maybeSingle();
    const linkProfile = (playerRow as { profile_id?: string | null } | null)?.profile_id;
    if (linkProfile) {
      await (supabase as any)
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', linkProfile);
    }

    return NextResponse.json({ ok: true, photo: publicUrl });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

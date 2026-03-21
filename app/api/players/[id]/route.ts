import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { isDashboardAdmin } from '@/lib/admin-request';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isDashboardAdmin())) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    const supabase = createAdminSupabase();
    await supabase.from('match_playing11').delete().eq('player_id', id);
    const { error } = await supabase.from('players').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

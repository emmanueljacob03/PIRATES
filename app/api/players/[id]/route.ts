import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { isDashboardAdmin } from '@/lib/admin-request';

/**
 * Removes the roster card, match stats / lineups, linked jerseys & contribution rows,
 * then deletes the linked Supabase Auth user (if any) so they must sign up again and be re-approved.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isDashboardAdmin())) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    const supabase = createAdminSupabase();
    const { data: player, error: fetchErr } = await supabase
      .from('players')
      .select('id, name, profile_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !player) {
      return NextResponse.json({ error: fetchErr?.message ?? 'Player not found' }, { status: 404 });
    }

    const row = player as { id: string; name: string | null; profile_id: string | null };
    const name = (row.name ?? '').trim();
    const profileId = row.profile_id;

    await supabase.from('match_playing11').delete().eq('player_id', id);
    await supabase.from('match_stats').delete().eq('player_id', id);

    if (name) {
      await supabase.from('jerseys').delete().eq('player_name', name);
      await supabase.from('contributions').delete().eq('player_name', name);
    }
    if (profileId) {
      await supabase.from('contributions').delete().eq('submitted_by_id', profileId);
    }

    const { error: delPlayerErr } = await supabase.from('players').delete().eq('id', id);
    if (delPlayerErr) return NextResponse.json({ error: delPlayerErr.message }, { status: 400 });

    if (profileId) {
      const { error: authErr } = await supabase.auth.admin.deleteUser(profileId);
      if (authErr) {
        return NextResponse.json(
          {
            error: `Roster removed but deleting login failed: ${authErr.message}. Remove the user in Supabase Dashboard → Authentication.`,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

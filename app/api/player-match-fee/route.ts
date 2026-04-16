import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

/** Admin sets Team Budget standard player match fee (profile + budget display). */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_admin')?.value !== 'true') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  let body: { value?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const raw = typeof body.value === 'string' ? body.value.trim() : String(body?.value ?? '0');
  const num = parseFloat(raw);
  const nextValue = isNaN(num) ? '0.00' : num.toFixed(2);

  try {
    const supabase = createAdminSupabase();
    const { error } = await (supabase as any).from('team_chat_settings').upsert(
      {
        id: 1,
        player_match_fee: nextValue,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    try {
      revalidatePath('/profiles');
      revalidatePath('/budget');
    } catch {
      /* ignore */
    }
    return NextResponse.json({ value: nextValue });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('player_match_fee') || msg.includes('schema cache') || msg.includes('PGRST')) {
      return NextResponse.json(
        {
          error:
            'Add column player_match_fee to team_chat_settings (run supabase/alter_team_chat_settings_player_match_fee.sql), then NOTIFY pgrst reload schema;',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_admin')?.value !== 'true') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  let body: { date?: string; time?: string; opponent?: string; ground?: string; isPractice?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const date = body.date ?? '';
  const time = body.time ?? '14:00';
  const opponent = body.isPractice ? 'Practice Session' : (body.opponent ?? '').trim();
  const ground = (body.ground ?? '').trim();
  if (!date || !opponent) {
    return NextResponse.json({ error: 'Date and opponent required' }, { status: 400 });
  }

  try {
    const supabase = createAdminSupabase();
    const { data, error } = await (supabase as any).from('matches').insert({
      date,
      time,
      opponent,
      ground: ground || '',
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'Server needs SUPABASE_SERVICE_ROLE_KEY in .env.local to add matches.' }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

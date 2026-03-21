import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { isBirthdayToday } from '@/lib/birthday-today';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ celebrants: [] }, { status: 401 });
    }

    const { data: rows, error } = await supabase.from('profiles').select('id, name, date_of_birth');
    if (error) {
      return NextResponse.json({ celebrants: [], error: error.message }, { status: 400 });
    }

    const celebrants = (rows ?? [])
      .filter((r: { date_of_birth?: string | null }) => isBirthdayToday(r.date_of_birth ?? null))
      .map((r: { id: string; name: string | null }) => ({
        id: r.id,
        name: (r.name ?? 'Teammate').trim() || 'Teammate',
      }));

    return NextResponse.json({ celebrants });
  } catch (e) {
    return NextResponse.json({ celebrants: [], error: (e as Error).message }, { status: 500 });
  }
}

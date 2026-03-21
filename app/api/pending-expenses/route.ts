import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('pirates_admin')?.value === 'true';
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  try {
    const supabase = createAdminSupabase();
    const { data, error } = await (supabase as any)
      .from('expenses')
      .select('id, submitted_by_name')
      .eq('bought', false);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const byName = new Map<string, number>();
    (data ?? []).forEach((r: { id: string; submitted_by_name?: string | null }) => {
      const name = (r.submitted_by_name ?? '').trim() || 'Unknown';
      byName.set(name, (byName.get(name) ?? 0) + 1);
    });

    const out = Array.from(byName.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('pirates_admin')?.value === 'true';

  const resolved = await Promise.resolve(params);
  const id = resolved.id?.trim();
  if (!id) return NextResponse.json({ error: 'Expense id required' }, { status: 400 });

  try {
    const supabase = createAdminSupabase();
    if (isAdmin) {
      const { error } = await (supabase as any).from('expenses').delete().eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    // Viewer: allow delete only for their own pending (bought=false) expenses.
    let authUserId: string | null = null;
    try {
      const userClient = createRouteHandlerClient<Database>({ cookies: () => cookieStore });
      const {
        data: { user },
      } = await userClient.auth.getUser();
      authUserId = user?.id ?? null;
    } catch {
      authUserId = null;
    }

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: expenseRow, error: fetchError } = await (supabase as any)
      .from('expenses')
      .select('id, bought, submitted_by_id')
      .eq('id', id)
      .single();

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 });
    if (!expenseRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (expenseRow.bought) {
      return NextResponse.json({ error: 'Approved expenses cannot be deleted by viewers' }, { status: 403 });
    }

    if (expenseRow.submitted_by_id !== authUserId) {
      return NextResponse.json({ error: 'You can only delete your own pending expenses' }, { status: 403 });
    }

    const { error } = await (supabase as any).from('expenses').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ error: 'Server needs SUPABASE_SERVICE_ROLE_KEY in .env.local to delete expenses.' }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


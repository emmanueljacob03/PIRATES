import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { isDashboardAdmin } from '@/lib/admin-request';

export async function GET() {
  if (!(await isDashboardAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, name, created_at')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data ?? []);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isDashboardAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const userId = String(body?.userId || '').trim();
    const action = body?.action === 'reject' ? 'reject' : body?.action === 'approve' ? 'approve' : null;
    if (!userId || !action) {
      return NextResponse.json({ error: 'userId and action (approve|reject) required' }, { status: 400 });
    }
    const supabase = createAdminSupabase();
    const approval_status = action === 'approve' ? 'approved' : 'rejected';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB types don't satisfy postgrest GenericTable (see ProfilePageClient)
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ approval_status, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

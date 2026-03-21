import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';

/** Team-code admin cookie or `profiles.role === 'admin'`. */
export async function isDashboardAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_admin')?.value === 'true') return true;
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    return (data as { role?: string } | null)?.role === 'admin';
  } catch {
    return false;
  }
}

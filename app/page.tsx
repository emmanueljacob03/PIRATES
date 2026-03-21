import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

/**
 * App entry: achievements welcome first for anyone not fully in (demo + code cookie).
 * Skip from achievements → /login?welcome=1 (credentials before team code).
 */
export default async function HomePage() {
  const cookieStore = await cookies();
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';
  const demo = cookieStore.get('pirates_demo')?.value === 'true';

  if (demo) redirect('/dashboard');

  try {
    const supabase = await createServerSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session && codeVerified) redirect('/dashboard');
  } catch {
    // Supabase not configured or failed – still show welcome
  }

  redirect('/achievements');
}

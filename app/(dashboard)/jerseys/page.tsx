import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import JerseysPageClient from '@/components/JerseysPageClient';
import type { Jersey } from '@/types/database';

export default async function JerseysPage() {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('pirates_admin')?.value === 'true';
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';
  let jerseys: Jersey[] = [];
  try {
    const supabase = codeVerified ? createAdminSupabase() : await createServerSupabase();
    const { data } = await (supabase as any).from('jerseys').select('*').order('jersey_number');
    jerseys = (data ?? []) as Jersey[];
  } catch {
    jerseys = [];
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-pirate-gold mb-6">Jerseys</h2>
      <JerseysPageClient initial={jerseys} isAdmin={isAdmin} />
    </div>
  );
}

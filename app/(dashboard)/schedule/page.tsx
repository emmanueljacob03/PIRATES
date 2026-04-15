import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import ScheduleList from '@/components/ScheduleList';
import AddMatchForm from '@/components/AddMatchForm';
import type { Match } from '@/types/database';

// Prevent stale cached schedule data after deletions.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SchedulePage() {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('pirates_admin')?.value === 'true';
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';

  let matches: Match[] = [];
  try {
    const supabase = codeVerified ? createAdminSupabase() : await createServerSupabase();
    const { data } = await (supabase as any).from('matches').select('*').order('date', { ascending: true });
    matches = (data ?? []) as Match[];
  } catch {
    matches = [];
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-pirate-gold mb-6">Match Schedule</h2>
      <div className={`grid gap-8 ${isAdmin ? 'md:grid-cols-2' : ''}`}>
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Calendar / List</h3>
          <ScheduleList matches={matches} isAdmin={isAdmin} />
        </div>
        {isAdmin && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Add Match / Practice</h3>
            <AddMatchForm />
          </div>
        )}
      </div>
    </div>
  );
}

import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import ScheduleList from '@/components/ScheduleList';
import AddMatchForm from '@/components/AddMatchForm';
import type { Match } from '@/types/database';
import type { Contribution, Expense } from '@/types/database';

// Prevent stale cached schedule data after deletions.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SchedulePage() {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('pirates_admin')?.value === 'true';
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';

  let matches: Match[] = [];
  let totalContributions = 0;
  let totalExpenses = 0;
  let remaining = 0;
  try {
    const supabase = codeVerified ? createAdminSupabase() : await createServerSupabase();
    const [matchesRes, contribRes, expRes] = await Promise.all([
      (supabase as any).from('matches').select('*').order('date', { ascending: true }),
      codeVerified
        ? (supabase as any).from('contributions').select('amount')
        : Promise.resolve({ data: [] }),
      codeVerified
        ? (supabase as any).from('expenses').select('cost, bought')
        : Promise.resolve({ data: [] }),
    ]);
    matches = (matchesRes.data ?? []) as Match[];
    const contribs = (contribRes.data ?? []) as Pick<Contribution, 'amount'>[];
    const expenses = (expRes.data ?? []) as (Expense & { bought?: boolean })[];
    totalContributions = contribs.reduce((s, c) => s + Number(c.amount), 0);
    totalExpenses = expenses.filter((e) => e.bought).reduce((s, e) => s + Number(e.cost), 0);
    remaining = totalContributions - totalExpenses;
  } catch {
    matches = [];
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-pirate-gold mb-6">Match Schedule</h2>
      {codeVerified && (
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="card">
            <p className="text-slate-400 text-sm">Total Match Fees</p>
            <p className="text-2xl font-bold text-green-400">${totalContributions.toFixed(2)}</p>
          </div>
          <div className="card">
            <p className="text-slate-400 text-sm">Expenses</p>
            <p className="text-2xl font-bold text-red-400">${totalExpenses.toFixed(2)}</p>
          </div>
          <div className="card">
            <p className="text-slate-400 text-sm">Remaining Budget</p>
            <p className="text-2xl font-bold text-amber-400">${remaining.toFixed(2)}</p>
          </div>
        </div>
      )}
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

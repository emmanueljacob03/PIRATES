import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';
import BudgetContributions from '@/components/BudgetContributions';
import BudgetExpenses from '@/components/BudgetExpenses';
import type { Contribution, Expense } from '@/types/database';

export default async function BudgetPage() {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('pirates_admin')?.value === 'true';
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';

  let contributions: Contribution[] = [];
  let expenses: (Expense & { bought?: boolean })[] = [];
  try {
    const supabase = codeVerified ? createAdminSupabase() : await createServerSupabase();
    const [contributionsRes, expensesRes] = await Promise.all([
      (supabase as any).from('contributions').select('*').order('date', { ascending: false }),
      (supabase as any).from('expenses').select('*').order('created_at', { ascending: false }),
    ]);
    contributions = (contributionsRes.data ?? []) as Contribution[];
    expenses = (expensesRes.data ?? []) as (Expense & { bought?: boolean })[];
  } catch {
    contributions = [];
    expenses = [];
  }

  const totalContributions = contributions.reduce((s, c) => s + Number(c.amount), 0);
  const totalExpensesBought = expenses.filter((e) => e.bought).reduce((s, e) => s + Number(e.cost), 0);
  const totalExpenses = totalExpensesBought;
  const remaining = totalContributions - totalExpensesBought;

  const contribProps = {
    initial: contributions,
    isAdmin,
    viewerMode: Boolean(codeVerified && !isAdmin),
  };

  if (!codeVerified) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--pirate-yellow)' }}>Team Budget</h2>
        <p className="text-slate-400 mb-4">Enter the team code to view budget and add match fees or expenses.</p>
        <div className="card max-w-2xl mx-auto">
          <h3 className="text-lg font-semibold mb-4">Player Match Fees</h3>
          <BudgetContributions {...contribProps} viewerMode={false} />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--pirate-yellow)' }}>Team Budget</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Player Match Fees</h3>
            <BudgetContributions {...contribProps} />
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Expenses</h3>
            <p className="text-slate-400 text-sm mb-2">Pending expenses will be shown grey until admin approval.</p>
            <BudgetExpenses initial={expenses} isAdmin={false} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--pirate-yellow)' }}>Team Budget</h2>
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
      <div className="grid md:grid-cols-2 gap-8">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Player Match Fees</h3>
          <BudgetContributions {...contribProps} viewerMode={false} />
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Expenses</h3>
          <p className="text-slate-400 text-sm mb-2">Add expenses one by one. Total updates above.</p>
          <BudgetExpenses initial={expenses} isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  );
}

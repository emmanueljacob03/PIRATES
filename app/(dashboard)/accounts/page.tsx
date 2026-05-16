import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import AccountsPageClient from '@/components/AccountsPageClient';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const cookieStore = await cookies();
  const demo = cookieStore.get('pirates_demo')?.value === 'true';
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';

  if (demo) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--pirate-yellow)' }}>
          Accounts
        </h2>
        <div className="card max-w-2xl">
          <p className="text-slate-400">Sign in with a real account to split expenses with teammates.</p>
        </div>
      </div>
    );
  }

  if (!codeVerified) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--pirate-yellow)' }}>
          Accounts
        </h2>
        <div className="card max-w-2xl">
          <p className="text-slate-400">Enter the team code to use shared accounts.</p>
        </div>
      </div>
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/dashboard');

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--pirate-yellow)' }}>
        Accounts
      </h2>
      <AccountsPageClient currentProfileId={user.id} />
    </div>
  );
}

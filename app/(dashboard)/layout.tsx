import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
import DashboardNav from '@/components/DashboardNav';
import TeamChatNavButton from '@/components/TeamChatNavButton';
import LogoutButton from '@/components/LogoutButton';
import PiratesHeader from '@/components/PiratesHeader';
import MatchNotification from '@/components/MatchNotification';
import BirthdaySlideNotification from '@/components/BirthdaySlideNotification';
import NotificationBar from '@/components/NotificationBar';
import ExpenseApprovalNotification from '@/components/ExpenseApprovalNotification';
import SignupApprovalRequests from '@/components/SignupApprovalRequests';
import ProfileIcon from '@/components/ProfileIcon';
import { isDashboardAdmin } from '@/lib/admin-request';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';
  const demo = cookieStore.get('pirates_demo')?.value === 'true';
  const isAdmin = cookieStore.get('pirates_admin')?.value === 'true';
  const showAdminTools = isAdmin || (await isDashboardAdmin());
  const modeLabel = isAdmin ? 'ADMIN: READ & WRITE' : 'VIEWER';

  let hasSession = false;
  try {
    const supabase = await createServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    hasSession = !!session;
  } catch {
    // ignore
  }

  const logoHref = hasSession && !demo ? '/profiles' : '/dashboard';

  // Require team-code cookie + session (demo bypasses). Avoids partial access and odd login loops.
  if (demo || (hasSession && codeVerified)) {
    return (
      <div className="min-h-screen bg-pirate-dark">
        <MatchNotification />
        {!demo && <BirthdaySlideNotification />}
        <header className="border-b border-slate-700 px-4 py-3 flex items-center justify-between gap-4">
          <PiratesHeader href={logoHref} />
          <div className="flex items-center gap-3 flex-1 justify-end max-w-2xl">
            {showAdminTools && <ExpenseApprovalNotification />}
            {showAdminTools && <SignupApprovalRequests />}
            <NotificationBar />
            <ProfileIcon />
            <LogoutButton />
          </div>
        </header>
        <main className="px-4 py-6 max-w-6xl mx-auto relative">
          <div className="absolute top-0 right-4 sm:right-0 z-10 flex flex-col items-end gap-2.5">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-slate-700 text-slate-200 leading-tight">
              {modeLabel}
            </span>
            <div className="translate-y-0.5">
              <TeamChatNavButton />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-700 pb-4 mb-6 w-full min-h-[2.75rem] pr-12 sm:pr-14">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              <DashboardNav />
            </div>
          </div>
          {children}
        </main>
      </div>
    );
  }

  // Send here instead of / — home sends users to /achievements when not fully onboarded.
  redirect('/login');
}

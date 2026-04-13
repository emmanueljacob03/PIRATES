import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
import DashboardNav from '@/components/DashboardNav';
import TeamChatNavButton from '@/components/TeamChatNavButton';
import PiratesHeader from '@/components/PiratesHeader';
import MatchNotification from '@/components/MatchNotification';
import BirthdaySlideNotification from '@/components/BirthdaySlideNotification';
import NotificationBar from '@/components/NotificationBar';
import ExpenseApprovalNotification from '@/components/ExpenseApprovalNotification';
import SignupApprovalRequests from '@/components/SignupApprovalRequests';
import ProfileIcon from '@/components/ProfileIcon';
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';
  const demo = cookieStore.get('pirates_demo')?.value === 'true';
  const isAdminCookie = cookieStore.get('pirates_admin')?.value === 'true';

  let hasSession = false;
  let showAdminTools = isAdminCookie;
  let profileAvatarUrl: string | null = null;
  try {
    const supabase = await createServerSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    hasSession = !!session;
    if (session?.user) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('role, avatar_url')
        .eq('id', session.user.id)
        .maybeSingle();
      const p = prof as { role?: string; avatar_url?: string | null } | null;
      profileAvatarUrl = p?.avatar_url?.trim() || null;
      if (!showAdminTools) showAdminTools = p?.role === 'admin';
    }
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
        <header className="border-b border-slate-700 px-3 sm:px-4 py-3 flex flex-col gap-2 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0 w-full">
            <div className="min-w-0 shrink">
              <PiratesHeader href={logoHref} />
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {showAdminTools && (
                <div className="hidden sm:flex max-w-[min(100%,14rem)] min-w-0">
                  <ExpenseApprovalNotification />
                </div>
              )}
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-2 md:gap-3">
                {showAdminTools && <SignupApprovalRequests />}
                <NotificationBar />
              </div>
              <ProfileIcon avatarUrl={profileAvatarUrl} />
            </div>
          </div>
          {showAdminTools && (
            <div className="flex sm:hidden justify-end w-full min-w-0">
              <ExpenseApprovalNotification />
            </div>
          )}
        </header>
        <main className="px-4 py-6 max-w-6xl mx-auto relative">
          <div className="absolute top-2 right-4 sm:right-0 z-10 flex flex-col items-end">
            <TeamChatNavButton />
          </div>
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-700 pb-4 mb-6 w-full min-h-[2.75rem] pr-16 sm:pr-20">
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

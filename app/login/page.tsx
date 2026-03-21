import { Suspense } from 'react';
import nextDynamic from 'next/dynamic';

/**
 * Client-only: LoginPage imports `createClientComponentClient` from Supabase, which can throw
 * during SSR on Vercel when navigating from /achievements (Skip → /login).
 */
const LoginPage = nextDynamic(() => import('@/components/LoginPage'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[var(--pirate-dark)] flex items-center justify-center text-slate-400">
      Loading…
    </div>
  ),
});

export const dynamic = 'force-dynamic';

export default function LoginRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--pirate-dark)] flex items-center justify-center text-slate-400">
          Loading…
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}

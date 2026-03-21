import { Suspense } from 'react';
import LoginPage from '@/components/LoginPage';

/** Avoid static prerender: LoginPage imports Supabase browser client, which breaks `next build` on Vercel. */
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

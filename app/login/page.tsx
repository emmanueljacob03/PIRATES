import { Suspense } from 'react';
import LoginPage from '@/components/LoginPage';

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

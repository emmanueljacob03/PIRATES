'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import CodeGate from './CodeGate';

export default function CodePageClient() {
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(!!s);
    });
  }, []);

  if (session === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pirate-dark">
        <p className="text-slate-400">Checking login...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pirate-dark">
        <div className="card max-w-sm text-center">
          <p className="text-slate-300 mb-4">Please log in first.</p>
          <Link href="/login" className="btn-primary inline-block">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return <CodeGate />;
}

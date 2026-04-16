'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FINANCE_UPDATED_EVENT } from '@/lib/finance-events';

/** Refetches server components when finance data changes (e.g. admin marks fee/jersey paid). */
export default function FinanceRefreshListener() {
  const router = useRouter();
  useEffect(() => {
    const fn = () => router.refresh();
    window.addEventListener(FINANCE_UPDATED_EVENT, fn);
    return () => window.removeEventListener(FINANCE_UPDATED_EVENT, fn);
  }, [router]);
  return null;
}

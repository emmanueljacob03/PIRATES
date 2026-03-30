'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function TeamChatNavButton() {
  const pathname = usePathname();
  const active = pathname === '/chat';
  return (
    <Link
      href="/chat"
      className={
        active
          ? 'flex items-center justify-center w-9 h-9 rounded-full bg-amber-500 text-slate-900 shadow-md border border-amber-300'
          : 'flex items-center justify-center w-9 h-9 rounded-full bg-slate-700/80 text-slate-200 hover:bg-emerald-700/80 hover:text-white border border-slate-600 shadow-sm transition-colors'
      }
      title="Chat"
      aria-label="Open Pirates chat"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    </Link>
  );
}

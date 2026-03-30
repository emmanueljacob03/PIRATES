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
          ? 'flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-amber-500 text-slate-900 shadow-lg border-2 border-amber-300 text-sm font-semibold'
          : 'flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-slate-700/80 text-slate-200 hover:bg-emerald-700/80 hover:text-white border border-slate-600 shadow-md transition-colors text-sm font-medium'
      }
      title="Team chat"
      aria-label="Team chat"
    >
      <span className="flex items-center justify-center w-9 h-9 rounded-full bg-black/10 shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </span>
      <span className="whitespace-nowrap">Team chat</span>
    </Link>
  );
}

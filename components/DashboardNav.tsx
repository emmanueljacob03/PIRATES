'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/jerseys', label: 'Jerseys' },
  { href: '/budget', label: 'Team Budget' },
  { href: '/schedule', label: 'Match Schedule' },
  { href: '/media', label: 'Match Media' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/players', label: 'Players' },
];

export default function DashboardNav() {
  const pathname = usePathname();
  return (
    <>
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={
            pathname === href
              ? 'px-3 py-2 rounded-lg font-medium bg-amber-500 text-slate-900'
              : 'px-3 py-2 rounded-lg font-medium bg-slate-700/50 text-slate-300 hover:bg-slate-600'
          }
        >
          {label}
        </Link>
      ))}
    </>
  );
}

'use client';

import React, { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/jerseys', label: 'Jerseys' },
  { href: '/budget', label: 'Team Budget' },
  { href: '/schedule', label: 'Match Schedule' },
  { href: '/media', label: 'Match Media' },
  { href: '/live', label: 'Live Stream' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/players', label: 'Players' },
] as const;

function isActive(pathname: string, href: string) {
  if (href === '/media') return pathname === '/media' || pathname.startsWith('/media/');
  if (href === '/schedule') return pathname === '/schedule' || pathname.startsWith('/schedule/');
  if (href === '/players') return pathname === '/players' || pathname.startsWith('/players/');
  return pathname === href;
}

function currentSectionLabel(pathname: string) {
  const found = links.find((l) => isActive(pathname, l.href));
  if (found) return found.label;
  if (pathname.startsWith('/profiles')) return 'Profile';
  if (pathname.startsWith('/chat')) return 'Team chat';
  return 'Pirates';
}

export default function DashboardNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  const section = currentSectionLabel(pathname);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return;
  }, [open]);

  return (
    <div className="flex items-center gap-3 min-w-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-slate-200 hover:bg-slate-700 hover:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/60 shrink-0"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Open menu"
      >
        <svg
          className="w-6 h-6 text-amber-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span className="text-sm font-medium hidden sm:inline">Menu</span>
      </button>
      <p className="text-slate-300 text-sm font-medium truncate min-w-0">
        {section}
      </p>

      {open ? (
        <div className="fixed inset-0 z-[100]">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <nav
            id={menuId}
            className="absolute top-0 left-0 h-full w-[min(20rem,92vw)] max-w-md flex flex-col bg-slate-900 border-r border-amber-500/20 shadow-2xl shadow-black/50"
            aria-label="Main navigation"
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-700">
              <span className="text-amber-200 font-semibold">Go to</span>
              <button
                type="button"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ul className="p-2 overflow-y-auto flex-1">
              {links.map(({ href, label }) => {
                const active = isActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      className={
                        active
                          ? 'block rounded-lg px-3 py-3 text-base font-medium bg-amber-500 text-slate-900'
                          : 'block rounded-lg px-3 py-3 text-base font-medium text-slate-200 hover:bg-slate-800'
                      }
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      ) : null}
    </div>
  );
}

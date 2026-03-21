'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';

export default function PiratesHeader({ href = '/dashboard' }: { href?: string }) {
  const [icon, setIcon] = useState<'thunder' | 'trophy'>('thunder');

  useEffect(() => {
    const t = setInterval(() => setIcon((i) => (i === 'thunder' ? 'trophy' : 'thunder')), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <Link
      href={href}
      className="flex items-center gap-3 no-underline hover:opacity-90 transition-opacity"
      aria-label={href === '/profiles' ? 'PIRATES – my profile' : 'PIRATES – go to dashboard'}
    >
      <div className="relative flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 border-[var(--pirate-yellow)] bg-[var(--pirate-navy)]">
        <Image
          src="/pirates-emblem.png"
          alt=""
          width={80}
          height={80}
          className="object-cover object-center w-full h-full"
        />
      </div>
      <span className="text-xl font-bold tracking-wide uppercase" style={{ color: 'var(--pirate-yellow)' }}>
        PIRATES
      </span>
      <span
        className="text-2xl ml-1 flex-shrink-0 opacity-90"
        style={{ animation: 'pirates-thunder 2s ease-in-out infinite' }}
        aria-hidden
      >
        {icon === 'thunder' ? '⚡' : '🏆'}
      </span>
    </Link>
  );
}

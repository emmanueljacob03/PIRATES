'use client';

import Link from 'next/link';

export default function ProfileIcon() {
  return (
    <Link
      href="/profiles"
      className="flex items-center justify-center w-9 h-9 rounded-full border-2 border-[var(--pirate-yellow)] bg-[var(--pirate-navy)] text-[var(--pirate-yellow)] hover:opacity-90"
      aria-label="My profile"
    >
      <span className="text-lg leading-none">👤</span>
    </Link>
  );
}

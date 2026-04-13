'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function ProfileIcon({ avatarUrl }: { avatarUrl?: string | null }) {
  const url = avatarUrl?.trim();
  const hasPhoto = !!url;

  return (
    <Link
      href="/profiles"
      className="relative flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 border-[var(--pirate-yellow)] bg-[var(--pirate-navy)] text-[var(--pirate-yellow)] hover:opacity-90 overflow-hidden shrink-0"
      aria-label="My profile"
    >
      {hasPhoto ? (
        <Image src={url} alt="" fill className="object-cover" sizes="48px" />
      ) : (
        <span className="text-xl sm:text-2xl leading-none">👤</span>
      )}
    </Link>
  );
}

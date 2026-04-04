'use client';

import Image from 'next/image';
import DesiredCollectionCard from '@/components/DesiredCollectionCard';

export type DashboardMvp = { name: string; photoUrl: string | null };

export default function DashboardMetrics({
  totalPlayers,
  desiredCollectionsInitial,
  totalMatches,
  mvp,
  isAdmin,
}: {
  totalPlayers: number;
  desiredCollectionsInitial: string;
  totalMatches: number;
  mvp: DashboardMvp | null;
  isAdmin: boolean;
}) {
  return (
    <>
      <div className="card card-hover-lift min-w-0">
        <p className="text-slate-400 text-sm">Total Players</p>
        <p className="text-xl font-semibold text-white mt-1">{totalPlayers}</p>
      </div>
      <DesiredCollectionCard isAdmin={isAdmin} initialValue={desiredCollectionsInitial} />
      <div className="card card-hover-lift min-w-0">
        <p className="text-slate-400 text-sm">Total Matches</p>
        <p className="text-xl font-semibold text-white mt-1">{totalMatches}</p>
      </div>
      <div
        className="card card-hover-lift min-w-0 overflow-hidden rounded-xl border-[3px] border-[var(--pirate-yellow)] bg-gradient-to-br from-amber-950/95 via-slate-900 to-amber-950/90 shadow-[0_0_28px_rgba(250,204,21,0.5),0_0_48px_rgba(250,204,21,0.15)]"
      >
        <p className="text-slate-400 text-sm">MVP</p>
        {mvp && mvp.name ? (
          <div className="flex items-start gap-2 mt-1 min-h-[2.25rem] min-w-0">
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-700 ring-2 ring-amber-400/60">
              {mvp.photoUrl ? (
                <Image src={mvp.photoUrl} alt="" fill className="object-cover" sizes="36px" />
              ) : null}
            </div>
            <p
              className="min-w-0 flex-1 text-lg sm:text-xl font-semibold text-amber-100 leading-snug line-clamp-2 break-words drop-shadow-sm"
              title={mvp.name}
            >
              {mvp.name}
            </p>
          </div>
        ) : (
          <p className="text-xl font-semibold text-amber-200/80 mt-1">—</p>
        )}
      </div>
    </>
  );
}

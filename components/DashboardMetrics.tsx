'use client';

import DesiredCollectionCard from '@/components/DesiredCollectionCard';

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
  mvp: string;
  isAdmin: boolean;
}) {
  return (
    <>
      <div className="card card-hover-lift">
        <p className="text-slate-400 text-sm">Total Players</p>
        <p className="text-xl font-semibold text-white mt-1">{totalPlayers}</p>
      </div>
      <DesiredCollectionCard isAdmin={isAdmin} initialValue={desiredCollectionsInitial} />
      <div className="card card-hover-lift">
        <p className="text-slate-400 text-sm">Total Matches</p>
        <p className="text-xl font-semibold text-white mt-1">{totalMatches}</p>
      </div>
      <div className="card card-hover-lift">
        <p className="text-slate-400 text-sm">MVP</p>
        <p className="text-xl font-semibold text-amber-400 mt-1">{mvp}</p>
      </div>
    </>
  );
}

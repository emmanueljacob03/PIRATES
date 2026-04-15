'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import DesiredCollectionCard from '@/components/DesiredCollectionCard';

export type DashboardMvp = { name: string; photoUrl: string | null };

function TotalMatchesCard({
  totalMatches,
  regularMatches,
  practiceMatches,
}: {
  totalMatches: number;
  regularMatches: number;
  practiceMatches: number;
}) {
  const [open, setOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<'hover' | 'tap'>('tap');
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => {
      const canHover = window.matchMedia('(hover: hover)').matches;
      const finePointer = window.matchMedia('(pointer: fine)').matches;
      const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const hoverUi = canHover && finePointer && !coarsePointer;
      setPanelMode(hoverUi ? 'hover' : 'tap');
    };
    sync();
    const queries = ['(hover: hover)', '(pointer: fine)', '(pointer: coarse)'].map((q) =>
      window.matchMedia(q),
    );
    queries.forEach((mq) => mq.addEventListener('change', sync));
    return () => queries.forEach((mq) => mq.removeEventListener('change', sync));
  }, []);

  const clearHide = useCallback(() => {
    if (hideRef.current) {
      clearTimeout(hideRef.current);
      hideRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHide();
    hideRef.current = setTimeout(() => setOpen(false), 220);
  }, [clearHide]);

  const handlePointerEnter = useCallback(() => {
    if (panelMode !== 'hover') return;
    clearHide();
    setOpen(true);
  }, [clearHide, panelMode]);

  const handlePointerLeave = useCallback(() => {
    if (panelMode !== 'hover') return;
    scheduleHide();
  }, [scheduleHide, panelMode]);

  const handleClick = useCallback(() => {
    if (panelMode === 'hover') return;
    setOpen((o) => !o);
  }, [panelMode]);

  const showPanel = open;

  return (
    <div
      className="card card-hover-lift min-w-0 relative"
      onMouseEnter={handlePointerEnter}
      onMouseLeave={handlePointerLeave}
    >
      <button
        type="button"
        className="w-full text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 touch-manipulation [-webkit-tap-highlight-color:transparent]"
        onClick={handleClick}
        aria-expanded={showPanel}
        aria-haspopup="true"
        aria-label={`Total matches ${totalMatches}. ${panelMode === 'tap' ? 'Tap' : 'Hover'} for matches vs practice breakdown.`}
      >
        <p className="text-slate-400 text-sm">Total Matches</p>
        <p className="text-xl font-semibold text-white mt-1 inline-block border-b border-dotted border-slate-500/80">
          {totalMatches}
        </p>
      </button>
      {showPanel && (
        <div
          className="absolute left-0 top-full z-30 mt-1 min-w-[220px] max-w-[min(100%,280px)] p-3 rounded-lg bg-slate-800 border border-amber-500/40 shadow-xl text-sm text-slate-200"
          onMouseEnter={handlePointerEnter}
          onMouseLeave={handlePointerLeave}
        >
          <p className="text-white font-medium mb-2 border-b border-slate-600 pb-2">Match breakdown</p>
          <ul className="space-y-1.5">
            <li className="flex justify-between gap-4">
              <span className="text-slate-400">Matches</span>
              <span className="font-semibold text-amber-100 tabular-nums">{regularMatches}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-slate-400">Practice matches</span>
              <span className="font-semibold text-amber-100 tabular-nums">{practiceMatches}</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default function DashboardMetrics({
  totalPlayers,
  desiredCollectionsInitial,
  totalMatches,
  regularMatches,
  practiceMatches,
  mvp,
  isAdmin,
}: {
  totalPlayers: number;
  desiredCollectionsInitial: string;
  totalMatches: number;
  regularMatches: number;
  practiceMatches: number;
  mvp: DashboardMvp | null;
  isAdmin: boolean;
}) {
  return (
    <>
      <div className="card card-hover-lift min-w-0">
        <p className="text-slate-400 text-sm">Total Players</p>
        <p className="text-xl font-semibold text-white mt-1">{totalPlayers}</p>
      </div>
      <DesiredCollectionCard
        key={desiredCollectionsInitial}
        isAdmin={isAdmin}
        initialValue={desiredCollectionsInitial}
      />
      <TotalMatchesCard
        totalMatches={totalMatches}
        regularMatches={regularMatches}
        practiceMatches={practiceMatches}
      />
      <div className="card card-hover-card-accent card-hover-lift min-w-0 overflow-hidden rounded-xl border-[3px] border-[var(--pirate-yellow)] bg-gradient-to-br from-amber-950/95 via-slate-900 to-amber-950/90">
        <p className="text-slate-400 text-sm">MVP</p>
        {mvp && mvp.name ? (
          <div className="flex items-start gap-2 mt-1 min-h-[2.75rem] min-w-0">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-slate-700 ring-2 ring-amber-400/60">
              {mvp.photoUrl ? (
                <Image src={mvp.photoUrl} alt="" fill className="object-cover" sizes="44px" />
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

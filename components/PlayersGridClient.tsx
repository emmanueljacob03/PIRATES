'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import PlayerPhotoUpload from '@/components/PlayerPhotoUpload';
import DeletePlayerButton from '@/components/DeletePlayerButton';

export type PlayersGridPlayer = {
  id: string;
  displayName: string;
  displayPhoto: string | null;
  jersey_number: number | null;
  role: string;
  updated_at?: string;
};

export default function PlayersGridClient({
  players,
  demo,
  canEditPhoto,
  canDeletePlayers,
}: {
  players: PlayersGridPlayer[];
  demo: boolean;
  canEditPhoto: boolean;
  canDeletePlayers: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flipOpen, setFlipOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const selected = selectedId ? players.find((p) => p.id === selectedId) : null;

  const close = useCallback(() => {
    setFlipOpen(false);
    if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current);
    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ms = reduced ? 0 : 520;
    closeTimerRef.current = window.setTimeout(() => {
      setSelectedId(null);
      closeTimerRef.current = null;
    }, ms);
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setFlipOpen(false);
      return;
    }
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setFlipOpen(false);
    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => setFlipOpen(true), reduced ? 0 : 60);
    return () => window.clearTimeout(t);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, close]);

  useEffect(() => {
    if (!selectedId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selectedId]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {players.map((p) => {
          const imgSrc =
            p.displayPhoto &&
            `${p.displayPhoto}${p.displayPhoto.includes('?') ? '&' : '?'}v=${encodeURIComponent(p.updated_at ?? p.id)}`;
          const showUpload = !demo && canEditPhoto;
          const content = (
            <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-800 pointer-events-none">
              {p.displayPhoto && imgSrc ? (
                <Image
                  key={imgSrc}
                  src={imgSrc}
                  alt={p.displayName}
                  fill
                  className="object-cover"
                  sizes="220px"
                  unoptimized
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-slate-500 text-xs px-2 text-center">
                  No photo yet
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-2 py-2 flex items-center justify-between gap-2 min-h-[2.75rem]">
                <p className="font-semibold text-xs sm:text-sm text-white truncate min-w-0 flex-1 pr-1">{p.displayName}</p>
                {showUpload ? (
                  <div
                    className="flex-shrink-0 self-end mb-0.5 pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <PlayerPhotoUpload playerId={p.id} playerName={p.displayName} compact />
                  </div>
                ) : null}
              </div>
            </div>
          );
          return (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedId(p.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedId(p.id);
                }
              }}
              className="card p-2 hover:border-amber-500/40 transition relative text-left w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 rounded-xl"
              aria-label={`View details for ${p.displayName}`}
            >
              {!demo && canDeletePlayers && (
                <DeletePlayerButton playerId={p.id} playerName={p.displayName} />
              )}
              {content}
            </div>
          );
        })}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm"
          role="presentation"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            className="absolute top-3 right-3 sm:top-5 sm:right-5 z-[110] flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-200 text-2xl font-light leading-none border border-slate-600 hover:bg-slate-700 hover:text-white shadow-lg"
            aria-label="Close player details"
          >
            ×
          </button>
          <div
            className="relative w-full max-w-[min(92vw,36rem)] [perspective:1200px]"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div
              className={`relative w-full aspect-square max-h-[min(85vh,36rem)] mx-auto transition-transform duration-500 ease-out [transform-style:preserve-3d] motion-reduce:transition-none ${
                flipOpen ? '[transform:rotateY(180deg)]' : '[transform:rotateY(0deg)]'
              }`}
            >
              {/* Front — same look as grid thumbnail */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden border border-slate-600 bg-slate-800 shadow-2xl [backface-visibility:hidden]">
                {selected.displayPhoto && imgUrl(selected) ? (
                  <Image
                    src={imgUrl(selected)!}
                    alt={selected.displayName}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 92vw, 36rem"
                    unoptimized
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
                    No photo yet
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-4 py-4">
                  <p className="font-semibold text-lg text-white">{selected.displayName}</p>
                </div>
              </div>

              {/* Back — details + image */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden border border-amber-500/40 bg-slate-900 shadow-2xl [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col sm:flex-row">
                <div className="relative w-full sm:w-1/2 min-h-[40%] sm:min-h-0 shrink-0 bg-slate-800">
                  {selected.displayPhoto && imgUrl(selected) ? (
                    <Image
                      src={imgUrl(selected)!}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 92vw, 18rem"
                      unoptimized
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm p-4">
                      No photo
                    </div>
                  )}
                </div>
                <div className="flex-1 p-4 sm:p-6 flex flex-col justify-center gap-3 text-left min-w-0">
                  <p className="text-amber-400 text-xs font-semibold uppercase tracking-wide">Player</p>
                  <h3 className="text-xl sm:text-2xl font-bold text-white leading-tight break-words">
                    {selected.displayName}
                  </h3>
                  <dl className="space-y-2 text-sm">
                    {selected.jersey_number != null && (
                      <div className="flex gap-2">
                        <dt className="text-slate-500 shrink-0">Jersey</dt>
                        <dd className="text-slate-100 font-medium">#{selected.jersey_number}</dd>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <dt className="text-slate-500 shrink-0">Role</dt>
                      <dd className="text-slate-100 font-medium break-words">{selected.role || '—'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function imgUrl(p: PlayersGridPlayer): string | null {
  if (!p.displayPhoto) return null;
  return `${p.displayPhoto}${p.displayPhoto.includes('?') ? '&' : '?'}v=${encodeURIComponent(p.updated_at ?? p.id)}`;
}

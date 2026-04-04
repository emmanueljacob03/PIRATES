'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import PlayerPhotoUpload from '@/components/PlayerPhotoUpload';
import DeletePlayerButton from '@/components/DeletePlayerButton';
import { getPlayerCardBack, type PlayerRecordTier } from '@/lib/player-card-bio';

export type PlayersGridPlayer = {
  id: string;
  displayName: string;
  displayPhoto: string | null;
  jersey_number: number | null;
  role: string;
  updated_at?: string;
  profileId: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactBirthday: string | null;
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
  const [contactOpen, setContactOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const selected = selectedId ? players.find((p) => p.id === selectedId) : null;

  const close = useCallback(() => {
    setContactOpen(false);
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
    setContactOpen(false);
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
      if (e.key !== 'Escape') return;
      if (contactOpen) setContactOpen(false);
      else close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, close, contactOpen]);

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
              <div
                className="absolute inset-0 rounded-2xl overflow-hidden border-[3px] border-[var(--pirate-yellow)] bg-slate-800 shadow-[0_0_28px_rgba(250,204,21,0.55),0_0_56px_rgba(250,204,21,0.2)] [backface-visibility:hidden]"
              >
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
              <PlayerCardBackFace
                selected={selected}
                contactOpen={contactOpen}
                onOpenContact={() => setContactOpen(true)}
                onCloseContact={() => setContactOpen(false)}
              />
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

function formatDob(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = parseISO(String(iso).slice(0, 10));
    return isValid(d) ? format(d, 'MMMM d, yyyy') : iso;
  } catch {
    return iso;
  }
}

function recordTierClass(tier: PlayerRecordTier | undefined): string {
  if (tier === 'strong') {
    return 'rounded-lg border-2 border-amber-400 bg-gradient-to-br from-amber-950 via-amber-900/80 to-amber-950/90 text-amber-50 font-bold px-3 py-2 shadow-[0_0_24px_rgba(251,191,36,0.2)]';
  }
  if (tier === 'accent') {
    return 'text-amber-200 font-semibold border-l-4 border-amber-400/90 pl-3 py-1 bg-slate-800/50 rounded-r';
  }
  return 'text-slate-300 py-0.5';
}

function PlayerCardBackFace({
  selected,
  contactOpen,
  onOpenContact,
  onCloseContact,
}: {
  selected: PlayersGridPlayer;
  contactOpen: boolean;
  onOpenContact: () => void;
  onCloseContact: () => void;
}) {
  const cardBack = getPlayerCardBack(selected.displayName, selected.role);

  return (
    <div className="absolute inset-0 rounded-2xl overflow-hidden border-[3px] border-[var(--pirate-yellow)] bg-slate-900 shadow-[0_0_28px_rgba(250,204,21,0.55),0_0_56px_rgba(250,204,21,0.2)] [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col sm:flex-row relative">
      <div className="relative w-full sm:w-2/5 min-h-[36%] sm:min-h-0 shrink-0 bg-slate-800">
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
      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
        <button
          type="button"
          className="absolute top-2 right-2 z-10 text-xs sm:text-sm font-medium px-3 py-1.5 rounded-md bg-amber-500/20 text-amber-200 border border-amber-500/50 hover:bg-amber-500/30"
          onClick={(e) => {
            e.stopPropagation();
            onOpenContact();
          }}
        >
          Details
        </button>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 pt-10 sm:pt-11 text-left space-y-3">
          <p className="text-amber-400 text-xs font-semibold uppercase tracking-wide">Player</p>
          <h3 className="text-xl sm:text-2xl font-bold text-white leading-tight break-words pr-16">
            {selected.displayName}
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex gap-2 flex-wrap items-baseline">
              <span className="text-slate-500 shrink-0">Role</span>
              <span className="text-slate-100 font-medium break-words">{cardBack.role || '—'}</span>
            </div>
            {selected.jersey_number != null && (
              <div className="flex gap-2">
                <span className="text-slate-500 shrink-0">Jersey</span>
                <span className="text-slate-200">#{selected.jersey_number}</span>
              </div>
            )}
          </div>
          {cardBack.records.length > 0 && (
            <div className="pt-1 border-t border-slate-700/80">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">Records</p>
              <ul className="space-y-2 text-sm list-none">
                {cardBack.records.map((r, i) => (
                  <li key={i} className={`leading-snug ${recordTierClass(r.tier ?? 'normal')}`}>
                    {r.tier === 'strong' ? null : (
                      <span className="text-slate-500 mr-1.5 font-normal">•</span>
                    )}
                    {r.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {contactOpen && (
        <div
          className="absolute inset-0 z-20 rounded-2xl bg-slate-950/98 border-[3px] border-[var(--pirate-yellow)] shadow-[inset_0_0_24px_rgba(250,204,21,0.08)] flex flex-col p-4 sm:p-5"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Contact details"
        >
          <div className="flex justify-end mb-1">
            <button
              type="button"
              onClick={onCloseContact}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-200 text-xl leading-none border border-slate-600 hover:bg-slate-700"
              aria-label="Close contact details"
            >
              ×
            </button>
          </div>
          <h4 className="text-amber-400 text-xs font-semibold uppercase tracking-wide">Contact</h4>
          {!selected.profileId ? (
            <p className="text-slate-400 text-sm mt-3">
              No login profile linked to this player card — phone, email, and birthday are unavailable.
            </p>
          ) : (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Phone</dt>
                <dd className="text-white mt-0.5 break-all">{selected.contactPhone?.trim() || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd className="text-white mt-0.5 break-all">{selected.contactEmail?.trim() || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Birthday</dt>
                <dd className="text-white mt-0.5">{formatDob(selected.contactBirthday)}</dd>
              </div>
            </dl>
          )}
        </div>
      )}
    </div>
  );
}

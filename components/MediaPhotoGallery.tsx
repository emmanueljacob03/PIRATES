'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Photo = {
  id: string;
  url: string;
  label?: string;
};

export default function MediaPhotoGallery({
  photos,
  canDelete = false,
  emptyText = 'No photos yet.',
  columnsClass = 'grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-8 gap-1',
}: {
  photos: Photo[];
  canDelete?: boolean;
  emptyText?: string;
  columnsClass?: string;
}) {
  const router = useRouter();
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const active = useMemo(() => {
    if (activeIdx == null) return null;
    if (activeIdx < 0 || activeIdx >= photos.length) return null;
    return photos[activeIdx];
  }, [activeIdx, photos]);

  const goPrev = () => {
    if (photos.length === 0 || activeIdx == null) return;
    setActiveIdx((activeIdx - 1 + photos.length) % photos.length);
  };
  const goNext = () => {
    if (photos.length === 0 || activeIdx == null) return;
    setActiveIdx((activeIdx + 1) % photos.length);
  };

  async function deletePhoto(photoId: string) {
    const ok = window.confirm('Delete this photo?');
    if (!ok) return;
    setDeletingId(photoId);
    try {
      const res = await fetch('/api/match-media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id: photoId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (data as { error?: string }).error || 'Delete failed';
        throw new Error(msg);
      }
      setActiveIdx(null);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className={columnsClass}>
        {photos.length === 0 ? (
          <p className="text-slate-500 col-span-full">{emptyText}</p>
        ) : (
          photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="group block text-left"
              onClick={() => setActiveIdx(i)}
              aria-label="Open photo"
            >
              <div className="aspect-square rounded-sm overflow-hidden bg-slate-700 border border-slate-600 group-hover:border-amber-400 transition">
                <img src={p.url} alt="" className="w-full h-full object-cover" />
              </div>
              {p.label ? (
                <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-tight">{p.label}</p>
              ) : null}
            </button>
          ))
        )}
      </div>

      {active ? (
        <div
          className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setActiveIdx(null)}
            className="absolute top-2 right-2 sm:top-4 sm:right-4 z-[2] h-10 w-10 rounded-full bg-slate-900/90 border border-slate-600 text-white text-2xl leading-none"
            aria-label="Close photo viewer"
          >
            ×
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-2 sm:left-4 z-[2] h-10 w-10 rounded-full bg-slate-900/90 border border-slate-600 text-white text-xl leading-none"
                aria-label="Previous photo"
                title="Previous"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute right-2 sm:right-4 z-[2] h-10 w-10 rounded-full bg-slate-900/90 border border-slate-600 text-white text-xl leading-none"
                aria-label="Next photo"
                title="Next"
              >
                ›
              </button>
            </>
          )}

          <div className="relative max-w-[96vw] w-full max-h-[92vh] h-full flex items-center justify-center">
            <img src={active.url} alt="" className="max-w-full max-h-full object-contain" />
          </div>

          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs sm:text-sm text-slate-200 bg-slate-900/85 border border-slate-700 rounded-full px-3 py-1.5">
            <span>
              {activeIdx! + 1} / {photos.length}
            </span>
            {canDelete && (
              <button
                type="button"
                className="ml-2 rounded-full border border-red-500/70 bg-red-950/60 px-2.5 py-0.5 text-red-200 hover:bg-red-900/70 disabled:opacity-40"
                onClick={() => deletePhoto(active.id)}
                disabled={deletingId === active.id}
                aria-label="Delete photo"
              >
                {deletingId === active.id ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}


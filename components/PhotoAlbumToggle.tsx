'use client';

type Photo = {
  id: string;
  url: string;
};

export default function PhotoAlbumToggle({ photos }: { photos: Photo[] }) {
  return (
    <>
      <div className="w-full flex items-center justify-between text-left mb-4">
        <h3 className="text-lg font-semibold">
          Photos <span className="text-amber-400">({photos.length})</span>
        </h3>
        <span className="text-xs text-slate-400">Open on the next page</span>
      </div>
      <p className="text-slate-500 text-sm">Click Photos to open the album.</p>
    </>
  );
}

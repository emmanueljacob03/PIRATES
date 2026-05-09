'use client';

import LiveStreamChat from '@/components/LiveStreamChat';

export default function PublicLiveWatchLayout({
  active,
  embedUrl,
}: {
  active: boolean;
  embedUrl: string | null;
}) {
  return (
    <div className="flex flex-col gap-6 w-full">
      {!active || !embedUrl ? (
        <div className="flex-1 flex items-center justify-center min-h-[45vh]">
          <p className="text-slate-400 text-center px-4">The stream is not live right now.</p>
        </div>
      ) : (
        <div className="relative w-full flex-1 min-h-[40vh] sm:min-h-0 sm:aspect-video bg-black rounded-lg overflow-hidden border border-slate-600">
          <iframe
            title="Live stream"
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}
      <LiveStreamChat canPost={false} publicWatchHref="/watch" />
    </div>
  );
}

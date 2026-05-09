'use client';

import LiveStreamWatchExperience from '@/components/LiveStreamWatchExperience';

export default function PublicLiveWatchLayout({
  active,
  embedUrl,
  rawWatchUrl,
}: {
  active: boolean;
  embedUrl: string | null;
  rawWatchUrl: string | null;
}) {
  return (
    <LiveStreamWatchExperience active={active} embedUrl={embedUrl} rawWatchUrl={rawWatchUrl} publicSharePath="/watch" />
  );
}

'use client';

import { useState } from 'react';
import AchievementsWelcome from '@/components/AchievementsWelcome';
import IntroVideo from '@/components/IntroVideo';

export default function AchievementsPage() {
  const [videoDone, setVideoDone] = useState(false);

  if (!videoDone) {
    return <IntroVideo onComplete={() => setVideoDone(true)} />;
  }

  return <AchievementsWelcome />;
}

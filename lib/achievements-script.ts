/**
 * Welcome narrative — segments control topic (photos) and pause after each chunk (human-like gaps).
 */
export type AchievementTopic =
  | 'intro'
  | 'club'
  | 'ram'
  | 'anil'
  | 'sampreeth'
  | 'abhinav'
  | 'outing'
  | 'outro';

export type AchievementSegment = {
  topic: AchievementTopic;
  /** Shown on screen (typed). Use \n\n between paragraphs. */
  text: string;
  /** Silence after this part is read aloud (ms). Bigger = longer breath between ideas. */
  pauseAfterMs?: number;
  /** Screen style for this chunk */
  variant?: 'title' | 'body' | 'closing';
};

export const achievementSegments: AchievementSegment[] = [
  {
    topic: 'intro',
    variant: 'title',
    text: `Hello there! How are you? Thanks for being here and taking a moment to learn about Pirates. Welcome to Pirates Cricket 🏏\n\n`,
    pauseAfterMs: 750,
  },
  {
    topic: 'intro',
    text: `We’re not just a cricket team—we’re a family. A group of brothers who come together, compete hard, and enjoy every match and every tournament as one unit.\n\n`,
    pauseAfterMs: 680,
  },
  {
    topic: 'ram',
    text: `Our journey started in the early 2020s under our former skipper Ram, when the team was known as happening11. What began as a small group quickly grew into something special, with over 40+ players being part of this journey over time.\n\n`,
    pauseAfterMs: 650,
  },
  {
    topic: 'sampreeth',
    text: `As we evolved, the team rebranded to Pirates, and under the leadership of skipper Sampreeth Sharma, we reached new heights—most notably winning the 2024 Summer League, along with multiple Man of the Match and Man of the Series awards. That season truly set the tone for who we are.\n\n`,
    pauseAfterMs: 680,
  },
  {
    topic: 'anil',
    text: `The momentum carried forward under skipper Anil Kumar Chandu, where we delivered a dominant league run—winning every match and going unbeaten until the finals. Though we narrowly missed the trophy, the season was filled with standout performances, including Man of the Series, Best Bowler, and Best Fielder recognitions.\n\n`,
    pauseAfterMs: 680,
  },
  {
    topic: 'abhinav',
    text: `Then came one of our most memorable chapters. Under skipper Abhinav Reddy, we entered our first-ever leather ball tournament. The start was rough—we faced consecutive losses, and many doubted whether we’d even secure a few wins. But that’s where Pirates showed its true spirit.\n\n`,
    pauseAfterMs: 650,
  },
  {
    topic: 'abhinav',
    text: `We bounced back.\nWe fought harder.\nWe surprised everyone.\n\n`,
    pauseAfterMs: 560,
  },
  {
    topic: 'abhinav',
    text: `Winning match after match, we made it to the qualifiers, defeated top-ranked teams in knockout rounds, and reached the finals. Though we finished as runners-up, our comeback story shook the entire Midwest cricket scene.\n\n`,
    pauseAfterMs: 720,
  },
  {
    topic: 'club',
    text: `At Pirates, we play fearless cricket. We play to win. And we play for each other.\n\n`,
    pauseAfterMs: 600,
  },
  {
    topic: 'club',
    text: `We also believe in giving opportunities—new players are always welcome, and every spot in the team is earned through performance and passion.\n\n`,
    pauseAfterMs: 650,
  },
  {
    topic: 'outing',
    text: `Beyond cricket, we bond as a family. From team outings to trips and celebrations, we make sure the journey is just as memorable as the victories.\n\n`,
    pauseAfterMs: 680,
  },
  {
    topic: 'outro',
    text: `If you’re interested in being part of Pirates, drop a message to the social media pages on the login page—we’d love to connect with you.\n\n`,
    pauseAfterMs: 650,
  },
  {
    topic: 'outro',
    variant: 'closing',
    text: `Go Pirates!`,
    pauseAfterMs: 0,
  },
];

/** Normalize for speech: no markdown, key emojis out, paragraph breaks → pause cues. */
export function toSpeechText(displayText: string): string {
  let s = displayText
    .replace(/\*\*/g, '')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\u00a0/g, ' ')
    .replace(/🏏|🏴‍☠️/g, '')
    .replace(/\uFE0F/g, '')
    .replace(/\n\n+/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > 0 && !/[.!?…]$/.test(s)) s += '.';
  return s;
}

export type NarrationChunk = {
  speechText: string;
  start: number;
  end: number;
  pauseAfterMs: number;
};

export function buildAchievementNarration(): {
  fullText: string;
  ranges: { topic: AchievementTopic; start: number; end: number }[];
  chunks: NarrationChunk[];
} {
  let cursor = 0;
  const ranges: { topic: AchievementTopic; start: number; end: number }[] = [];
  const chunks: NarrationChunk[] = [];

  for (const seg of achievementSegments) {
    const start = cursor;
    cursor += seg.text.length;
    ranges.push({ topic: seg.topic, start, end: cursor });
    const speechText = toSpeechText(seg.text);
    chunks.push({
      speechText: speechText.length > 0 ? speechText : seg.text.replace(/\n/g, ' ').trim() || ' ',
      start,
      end: cursor,
      pauseAfterMs: seg.pauseAfterMs ?? 480,
    });
  }

  return {
    fullText: achievementSegments.map((s) => s.text).join(''),
    ranges,
    chunks,
  };
}

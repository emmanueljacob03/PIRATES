/**
 * Welcome narrative — segments control topic (photos in Slide A) and pause after each chunk.
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
  /** Silence after this part is read aloud (ms). */
  pauseAfterMs?: number;
  variant?: 'title' | 'body' | 'closing';
};

export const achievementSegments: AchievementSegment[] = [
  {
    topic: 'intro',
    variant: 'title',
    text: `**Welcome to Pirates Cricket 🏏**\n\nHey there!\nWe’re glad you’re here and taking the time to get to know Pirates.\n\n`,
    pauseAfterMs: 720,
  },
  {
    topic: 'intro',
    text: `We’re not just a team—we’re a close-knit group that plays, grows, and celebrates together. It’s more like a brotherhood where everyone shows up with passion, commitment, and love for the game.\n\n`,
    pauseAfterMs: 700,
  },
  {
    topic: 'ram',
    text: `Pirates started its journey in the early 2020s when Ram brought together a group of enthusiastic players and built the foundation of this team. What began as a small setup gradually grew into a strong squad, with over 40 players being part of this journey. As we evolved, the name Pirates came to represent our fearless approach and strong team spirit.\n\n`,
    pauseAfterMs: 720,
  },
  {
    topic: 'club',
    text: `Over time, we’ve earned a reputation for being competitive, determined, and exciting on the field.\n\n`,
    pauseAfterMs: 600,
  },
  {
    topic: 'sampreeth',
    text: `The 2024 season was a big milestone for us, as Pirates went on to win the league title. It was also a year of standout individual performances:\n\n* Man of the Series — Anil Kumar Chandu (2001 points)\n* Man of the Match — Venkata Poonam (5 wickets in the final match)\n\n`,
    pauseAfterMs: 760,
  },
  {
    topic: 'anil',
    text: `In 2025, we carried that momentum forward and finished as runners-up after a highly competitive season. Once again, the team delivered strong performances:\n\n* Man of the Series — Anil Kumar Chandu (1083 points) along with best batsmen award\n* Best Bowler — Manoj (19 wickets) and also standing as runner up in best batsmen race\n\n`,
    pauseAfterMs: 780,
  },
  {
    topic: 'abhinav',
    text: `One of the most defining moments for Pirates was stepping into our first leather ball tournament. The beginning was tough, with a few early losses and low expectations from outside. But that phase showed who we really are.\n\n`,
    pauseAfterMs: 680,
  },
  {
    topic: 'abhinav',
    text: `We regrouped, stayed focused, and turned things around. With consistent wins, we pushed our way into the qualifiers, beat top-ranked teams in knockout matches, and reached the finals. Even though we ended as runners-up, the comeback we made earned respect and attention across the Midwest cricket scene.\n\n`,
    pauseAfterMs: 760,
  },
  {
    topic: 'abhinav',
    text: `That tournament wasn’t just about results—it showed our resilience, belief, and how we stand strong together as a team.\n\n`,
    pauseAfterMs: 640,
  },
  {
    topic: 'club',
    text: `At Pirates, we stand by a few simple values:\n\n* Play bold and fearless cricket\n* Support each other like family\n* Give chances to new players\n* Earn your place through performance\n\n`,
    pauseAfterMs: 640,
  },
  {
    topic: 'outing',
    text: `Off the field, we make sure to stay connected. Team outings, trips, and celebrations are a big part of our journey—they keep the bond strong beyond the game.\n\n`,
    pauseAfterMs: 680,
  },
  {
    topic: 'outing',
    text: `If you’re interested in joining Pirates, feel free to leave a message through the login page—we’ll get back to you.\n\n`,
    pauseAfterMs: 700,
  },
  {
    topic: 'outro',
    text: `**Once a Pirate, always a Pirate. 🏴‍☠️**`,
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

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
    text: `**Welcome to Pirates Cricket 🏏**\n\nHello!\nThanks for being here and taking a moment to learn about Pirates.\n\n`,
    pauseAfterMs: 750,
  },
  {
    topic: 'intro',
    text: `We’re more than just a cricket team—we’re a family. A group of brothers who come together, compete with passion, and enjoy every moment on and off the field.\n\n`,
    pauseAfterMs: 680,
  },
  {
    topic: 'ram',
    text: `Our journey began in the early 2020s, when **Ram** brought together a group of passionate players and laid the foundation for what Pirates is today. What started as a small team steadily grew into something strong— with **40+ players** being part of this journey over time.\n\nAs we evolved, we became *Pirates*—a name that reflects our fearless mindset and team spirit.\n\n`,
    pauseAfterMs: 650,
  },
  {
    topic: 'sampreeth',
    text: `In **2024**, we had a standout season where Pirates lifted the league title. That year also saw some incredible individual performances.\n\n* *Man of the Series* — Anil Kumar Chandu\n* *Man of the Match* — Venkata Poonam\n\nThat season truly set the tone for who we are.\n\n`,
    pauseAfterMs: 680,
  },
  {
    topic: 'anil',
    text: `In **2025**, we continued our strong run and finished as **runners-up** after an intense season. The team once again delivered outstanding performances:\n\n* *Man of the Series* — Anil Kumar Chandu\n* *Best Bowler* — Manoj\n* *Best Fielder* — Emmanuel\n\n`,
    pauseAfterMs: 680,
  },
  {
    topic: 'abhinav',
    text: `One of the most memorable chapters in our journey was our **first-ever leather ball tournament**. The start wasn’t easy—we faced a few tough losses early on, and expectations were low. But that’s where Pirates showed its true character.\n\n`,
    pauseAfterMs: 650,
  },
  {
    topic: 'abhinav',
    text: `We bounced back stronger, found our rhythm, and started winning consistently. Match by match, we climbed up, made it to the qualifiers, and defeated top-ranked teams in knockout games to reach the finals.\n\n`,
    pauseAfterMs: 560,
  },
  {
    topic: 'abhinav',
    text: `Although we finished as runners-up, the comeback we delivered caught everyone’s attention and earned respect across the Midwest cricket community.\n\nThat tournament defined us—not just by results, but by resilience, belief, and the way we fought together as a team.\n\n`,
    pauseAfterMs: 720,
  },
  {
    topic: 'club',
    text: `At Pirates, we believe in:\n\n* Playing fearless cricket\n* Supporting each other like family\n* Giving opportunities to new players\n* Earning your place through performance and commitment\n\n`,
    pauseAfterMs: 600,
  },
  {
    topic: 'club',
    text: `Beyond cricket, we value the bond we share. Team outings, trips, and celebrations are just as important as the matches we play—it’s what keeps the team close and strong.\n\n`,
    pauseAfterMs: 650,
  },
  {
    topic: 'outing',
    text: `If you’re interested in being part of Pirates, feel free to drop a message through the login page—we’d love to connect with you.\n\n`,
    pauseAfterMs: 680,
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

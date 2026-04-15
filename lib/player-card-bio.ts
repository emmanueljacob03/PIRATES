/**
 * Back-of-card copy for player flip modal. Matched on display name (first matching rule wins).
 * `strong` = captain / trophy lines. `accent` = other records.
 */

export type PlayerRecordTier = 'strong' | 'accent' | 'normal';

export type PlayerRecordLine = { text: string; tier?: PlayerRecordTier };

export type PlayerCardBack = {
  role: string;
  records: PlayerRecordLine[];
};

const ENTRIES: Array<{ test: (displayName: string) => boolean; back: PlayerCardBack }> = [
  /** “% name” style: both substrings must appear (order-free). More specific chandu rules before generic `chandu`. */
  {
    test: (dn) => /chandu/i.test(dn) && /pammi/i.test(dn),
    back: {
      role: 'Bowling all rounder',
      records: [],
    },
  },
  {
    test: (dn) => /venkat/i.test(dn) && /ponnam/i.test(dn),
    back: {
      role: 'Bowling all rounder',
      records: [{ text: 'Man of the Match in 2025 summer season final', tier: 'accent' }],
    },
  },
  {
    test: (dn) => /hemanth/i.test(dn),
    back: {
      role: 'Bowling all rounder',
      records: [],
    },
  },
  {
    test: (dn) => /\bsiddarth\b/i.test(dn),
    back: {
      role: 'Bowling all rounder',
      records: [],
    },
  },
  {
    test: (dn) => /chandu/i.test(dn),
    back: {
      role: 'Opening Batsmen',
      records: [
        { text: 'Present Captain', tier: 'strong' },
        { text: 'HOLD Runners Trophy', tier: 'strong' },
        { text: 'Man of the Series 2024 summer season', tier: 'accent' },
        { text: 'Best batsmen 2025 summer spring season', tier: 'accent' },
        { text: '2025 season Captain (highest win streak)', tier: 'accent' },
      ],
    },
  },
  {
    test: (dn) => /sampreeth/i.test(dn),
    back: {
      role: 'Opening Batsmen',
      records: [
        { text: 'Hold 2024 Championship trophy', tier: 'strong' },
        { text: 'X Pirates Captain', tier: 'accent' },
      ],
    },
  },
  {
    test: (dn) => /manoj/i.test(dn),
    back: {
      role: 'Batting all rounder',
      records: [
        { text: '2025 spring season best Bowler', tier: 'accent' },
        { text: '2025 spring season best batsmen runner', tier: 'accent' },
      ],
    },
  },
  {
    test: (dn) => /emmanuel/i.test(dn),
    back: {
      role: 'Batting all rounder',
      records: [{ text: '2025 spring season best fielder', tier: 'accent' }],
    },
  },
  {
    test: (dn) => /abhinav/i.test(dn),
    back: {
      role: 'Opening Batsmen',
      records: [
        {
          text: 'Hold Pirates runners Trophy in 1st ever Pirates leather ball tournament season',
          tier: 'strong',
        },
        { text: 'X. Pirates Captain', tier: 'accent' },
      ],
    },
  },
  {
    test: (dn) => /praneeth/i.test(dn),
    back: {
      role: 'Batting all rounder',
      records: [{ text: 'Half century in the MWCL final', tier: 'accent' }],
    },
  },
  {
    test: (dn) => /\bhari\b/i.test(dn) || /^hari/i.test(dn.trim()),
    back: {
      role: 'Middle order batsmen',
      records: [{ text: 'Still a Mistry', tier: 'accent' }],
    },
  },
  {
    test: (dn) => /\bjoseph\b/i.test(dn),
    back: {
      role: 'Batsmen',
      records: [{ text: 'Finisher', tier: 'accent' }],
    },
  },
  {
    test: (dn) => {
      const t = dn.trim();
      return /^\s*jay\s*$/i.test(t) || /^jay\b/i.test(t);
    },
    back: {
      role: 'Batsmen',
      records: [{ text: 'Finisher', tier: 'accent' }],
    },
  },
  {
    test: (dn) => /nirupam/i.test(dn),
    back: {
      role: 'Bowling all rounder',
      records: [{ text: 'Best fielder', tier: 'accent' }],
    },
  },
  {
    test: (dn) => /praveen/i.test(dn),
    back: {
      role: 'Bowler',
      records: [],
    },
  },
  {
    test: (dn) => /deeraj|sai\s*deeraj/i.test(dn),
    back: {
      role: 'Bowling all rounder',
      records: [],
    },
  },
  {
    test: (dn) => /\bsiddharth\b/i.test(dn),
    back: {
      role: 'Bowler',
      records: [],
    },
  },
  {
    test: (dn) => /\bkiran\b/i.test(dn),
    back: {
      role: 'Bowler',
      records: [],
    },
  },
  {
    /** Prasanth Dharavathu: surname required so other Prashanths are not matched. */
    test: (dn) => /dharavathu/i.test(dn) && /pras(h)?anth/i.test(dn),
    back: {
      role: 'Bowler',
      records: [{ text: 'Match Turner', tier: 'accent' }],
    },
  },
];

export function getPlayerCardBack(displayName: string, fallbackRole: string): PlayerCardBack {
  const dn = displayName.trim();
  for (const e of ENTRIES) {
    if (e.test(dn)) return { role: e.back.role, records: e.back.records };
  }
  return { role: fallbackRole || 'Player', records: [] };
}

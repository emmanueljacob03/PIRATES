/** Preset sticker rows (emoji + label) — Tollywood / Indian humour vibes. */

export type ChatSticker = { emoji: string; label: string };

export const CHAT_STICKER_PACKS: { title: string; items: ChatSticker[] }[] = [
  {
    title: 'Tollywood',
    items: [
      { emoji: '🎬', label: 'Mass' },
      { emoji: '🍿', label: 'Interval' },
      { emoji: '🔥', label: 'Blockbuster' },
      { emoji: '👑', label: 'Hero entry' },
      { emoji: '💃', label: 'Item song' },
      { emoji: '🎭', label: 'Dialogue' },
      { emoji: '🥁', label: 'BGM' },
      { emoji: '⚡', label: 'Interval bang' },
    ],
  },
  {
    title: 'Indian funny',
    items: [
      { emoji: '😂', label: 'Rofl' },
      { emoji: '🤣', label: 'Too much' },
      { emoji: '😭', label: 'Senti' },
      { emoji: '🫡', label: 'Ji sir' },
      { emoji: '🙏', label: 'Please yaar' },
      { emoji: '😎', label: 'Cool' },
      { emoji: '🫠', label: 'Gone case' },
      { emoji: '🧿', label: 'Nazar' },
      { emoji: '🍵', label: 'Tea' },
      { emoji: '🥭', label: 'Aam' },
    ],
  },
];

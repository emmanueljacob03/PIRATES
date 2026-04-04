/** Short second-person lines shown on the birthday slide; one per celebrant (deterministic per day). */
export const BIRTHDAY_SLIDE_MESSAGES = [
  'You are essential to what makes Pirates special.',
  'Your energy lifts the whole squad—thank you for being you.',
  "Pirates wouldn't be the same without your heart and hustle.",
  'You matter here more than you know—enjoy every minute today.',
  'The team is stronger because you are in it.',
  'Your presence on and off the pitch means the world to us.',
  "You're one of the reasons we keep showing up. Celebrate big today.",
  'Pirates cherish members like you—today we celebrate you.',
  'You bring spirit and grit that inspire everyone around you.',
  'Thank you for giving your all to this team—you deserve the best day.',
  "You're valued not just as a player, but as part of our crew.",
  'The club is lucky to have you. Savor this day.',
  'Your dedication does not go unnoticed—you are a cornerstone of Pirates.',
  "You're the kind of teammate everyone hopes for. Happy birthday!",
  'Today is about you: thank you for being irreplaceable to Pirates.',
  'You make hard practices lighter and match days unforgettable.',
  'We are grateful for your loyalty, laughter, and effort—cheers to you!',
  'You embody what Pirates stands for. Have a brilliant birthday.',
  'Your contribution goes beyond the scoreboard—you lift people. That is rare.',
  "You are most important to Pirates—never doubt it. Enjoy your day.",
] as const;

export function pickBirthdaySlideMessage(userId: string, ymd: string): string {
  const s = `${userId}\0${ymd}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return BIRTHDAY_SLIDE_MESSAGES[h % BIRTHDAY_SLIDE_MESSAGES.length];
}

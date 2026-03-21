import type { NextResponse } from 'next/server';

/** Client-readable cookie: set when user enters dashboard after team code / gate / demo. */
export const SLIDE_REMINDER_COOKIE = 'pirates_show_slide_reminder';

export function setSlideReminderCookieOnResponse(res: NextResponse) {
  res.cookies.set(SLIDE_REMINDER_COOKIE, '1', {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 180,
  });
}

/** Clear dismiss state once after login; removes the cookie so it only runs first hop to dashboard. */
export function consumeSlideReminderCookieInBrowser(): boolean {
  if (typeof document === 'undefined') return false;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    const name = (idx === -1 ? part : part.slice(0, idx)).trim();
    if (name === SLIDE_REMINDER_COOKIE) {
      const value = idx === -1 ? '' : part.slice(idx + 1).trim();
      if (value === '1') {
        document.cookie = `${SLIDE_REMINDER_COOKIE}=; path=/; max-age=0`;
        return true;
      }
    }
  }
  return false;
}

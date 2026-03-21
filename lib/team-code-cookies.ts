import type { NextResponse } from 'next/server';
import { setSlideReminderCookieOnResponse } from '@/lib/slide-reminder-cookie';

const cookieBase = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

/** Sets team-code + admin cookies and slide reminder (used by handoff redirect and form POST). */
export function applyPiratesTeamCodeCookies(res: NextResponse, isAdmin: boolean) {
  res.cookies.set('pirates_code_verified', 'true', {
    ...cookieBase,
    maxAge: 60 * 60 * 24,
  });
  if (isAdmin) {
    res.cookies.set('pirates_admin', 'true', {
      ...cookieBase,
      maxAge: 60 * 60 * 24,
    });
  } else {
    res.cookies.set('pirates_admin', '', {
      ...cookieBase,
      maxAge: 0,
    });
  }
  setSlideReminderCookieOnResponse(res);
}

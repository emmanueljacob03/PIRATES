import { NextRequest, NextResponse } from 'next/server';
import { consumeCodeToken } from '@/lib/code-token-store';
import { setSlideReminderCookieOnResponse } from '@/lib/slide-reminder-cookie';

/**
 * GET /gate?token=...&next=/dashboard
 * Validates the one-time token (from verify-code), sets the code cookie, redirects to dashboard.
 * Full page load so the browser always receives and stores the Set-Cookie.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const nextPath = req.nextUrl.searchParams.get('next') || '/dashboard';
  const safeNext = nextPath.startsWith('/') ? nextPath : '/dashboard';

  if (!token || !consumeCodeToken(token)) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const res = NextResponse.redirect(new URL(safeNext, req.url));
  res.cookies.set('pirates_code_verified', 'true', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24,
  });
  setSlideReminderCookieOnResponse(res);
  return res;
}

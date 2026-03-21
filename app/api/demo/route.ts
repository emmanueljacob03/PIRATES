import { NextRequest, NextResponse } from 'next/server';
import { setSlideReminderCookieOnResponse } from '@/lib/slide-reminder-cookie';

/**
 * POST /api/demo – enter the portal without login (no Supabase, no queries).
 * Sets cookies so dashboard layout allows access.
 */
export async function POST(req: NextRequest) {
  const url = new URL('/dashboard', req.url);
  const res = NextResponse.redirect(url);
  res.cookies.set('pirates_demo', 'true', { path: '/', maxAge: 60 * 60 * 24 });
  res.cookies.set('pirates_code_verified', 'true', { path: '/', maxAge: 60 * 60 * 24 });
  setSlideReminderCookieOnResponse(res);
  return res;
}

import { NextRequest, NextResponse } from 'next/server';
import { validateCodeToken } from '@/lib/code-token-store';
import { setSlideReminderCookieOnResponse } from '@/lib/slide-reminder-cookie';

const ENTRY_CODE = (process.env.PIRATES_SECURITY_CODE || 'Pirates102').trim().toLowerCase();
const ADMIN_CODE = (process.env.PIRATES_ADMIN_CODE || '#Pirateswinners1').trim().toLowerCase();

function isEntryCode(code: string): boolean {
  return code.trim().toLowerCase() === ENTRY_CODE;
}
function isAdminCode(code: string): boolean {
  return code.trim().toLowerCase() === ADMIN_CODE;
}

/**
 * POST with body { token, code } or form token=... & code=...
 * Validates token or code (one shared team code for everyone), sets cookie, redirects to /dashboard.
 */
function setTeamCookiesOnResponse(res: NextResponse, code: string | null) {
  res.cookies.set('pirates_code_verified', 'true', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24,
  });
  if (code && isAdminCode(code)) {
    res.cookies.set('pirates_admin', 'true', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24,
    });
  } else {
    res.cookies.set('pirates_admin', '', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 0,
    });
  }
}

export async function POST(req: NextRequest) {
  let token: string | null = null;
  let code: string | null = null;
  const contentType = req.headers.get('content-type') || '';
  const accept = req.headers.get('accept') || '';
  const returnJson = accept.includes('application/json');
  try {
    if (contentType.includes('application/json')) {
      const body = await req.json();
      token = body?.token ?? null;
      code = body?.code ?? null;
    } else {
      const formData = await req.formData();
      token = (formData.get('token') as string) || null;
      code = (formData.get('code') as string) || null;
    }
  } catch {
    token = null;
    code = null;
  }

  const validToken = token && validateCodeToken(token);
  const validCode = code && (isEntryCode(code) || isAdminCode(code));

  if (!validToken && !validCode) {
    if (returnJson) {
      return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 });
    }
    return NextResponse.redirect(new URL('/login?code=invalid', req.url), 303);
  }

  if (returnJson) {
    const res = NextResponse.json({ ok: true });
    setTeamCookiesOnResponse(res, code);
    setSlideReminderCookieOnResponse(res);
    return res;
  }

  // Form / non-JSON clients: 303 = force GET on next hop (avoid POST replay to /dashboard).
  const res = NextResponse.redirect(new URL('/dashboard', req.url), 303);
  setTeamCookiesOnResponse(res, code);
  setSlideReminderCookieOnResponse(res);
  return res;
}

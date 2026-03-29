import { NextRequest, NextResponse } from 'next/server';
import { validateCodeToken } from '@/lib/code-token-store';
import { applyPiratesTeamCodeCookies } from '@/lib/team-code-cookies';
import { createTeamCodeHandoffToken } from '@/lib/team-code-handoff-token';
import { getAdminTeamCode, getViewerTeamCode } from '@/lib/team-codes';

function isEntryCode(code: string): boolean {
  return code.trim() === getViewerTeamCode();
}
function isAdminCode(code: string): boolean {
  return code.trim() === getAdminTeamCode();
}

/**
 * POST with body { token, code } or form token=... & code=...
 * Validates token or code, sets cookie, redirects to /dashboard (non-JSON).
 * JSON clients get { ok, handoff } and must GET /api/team-code-handoff?t=... so cookies attach on a real navigation.
 */
export async function POST(req: NextRequest) {
  let token: string | null = null;
  let code: string | null = null;
  const contentType = req.headers.get('content-type') || '';
  const returnJson = contentType.includes('application/json');
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

  const isAdmin = !!(code && isAdminCode(code));

  if (returnJson) {
    // Do not Set-Cookie on fetch JSON — browsers/RSC can miss them before /dashboard. Client uses handoff GET.
    const handoff = createTeamCodeHandoffToken(isAdmin);
    return NextResponse.json({ ok: true, handoff });
  }

  const res = NextResponse.redirect(new URL('/dashboard', req.url), 303);
  applyPiratesTeamCodeCookies(res, isAdmin);
  return res;
}

import { NextRequest, NextResponse } from 'next/server';
import { parseTeamCodeHandoffToken } from '@/lib/team-code-handoff-token';
import { applyPiratesTeamCodeCookies } from '@/lib/team-code-cookies';

/**
 * Full GET navigation after JSON team-code check. Sets cookies on this response + 303 to /dashboard
 * so the browser always stores cookies before the dashboard RSC request (fixes first-hop loops).
 */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t');
  const parsed = parseTeamCodeHandoffToken(t);
  if (!parsed) {
    return NextResponse.redirect(new URL('/login?code=invalid', req.url), 303);
  }
  const res = NextResponse.redirect(new URL('/dashboard', req.url), 303);
  applyPiratesTeamCodeCookies(res, parsed.isAdmin);
  return res;
}

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  try {
    const res = NextResponse.next();
    try {
      const supabase = createMiddlewareClient({ req, res });
      await supabase.auth.getSession();
    } catch {
      // Supabase env missing or invalid – still allow request through
    }
    return res;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/',
    '/achievements',
    '/login',
    '/auth/callback',
    '/api/birthdays-today',
    '/api/team-code-handoff',
    '/api/upcoming-matches',
    '/dashboard',
    '/dashboard/:path*',
    '/code',
    '/jerseys',
    '/budget',
    '/schedule',
    '/media/:path*',
    '/leaderboard',
    '/players/:path*',
    '/profiles',
  ],
};

import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('pirates_code_verified', '', { path: '/', maxAge: 0 });
  res.cookies.set('pirates_demo', '', { path: '/', maxAge: 0 });
  return res;
}

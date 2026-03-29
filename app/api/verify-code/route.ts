import { NextRequest, NextResponse } from 'next/server';
import { createCodeToken } from '@/lib/code-token-store';
import { getAdminTeamCode, getViewerTeamCode } from '@/lib/team-codes';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    const viewer = getViewerTeamCode();
    const admin = getAdminTeamCode();
    const valid = code && (code === viewer || code === admin);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }
    const token = createCodeToken();
    const isAdmin = code === admin;
    return NextResponse.json({ ok: true, token, isAdmin });
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}

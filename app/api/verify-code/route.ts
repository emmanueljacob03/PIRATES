import { NextRequest, NextResponse } from 'next/server';
import { createCodeToken } from '@/lib/code-token-store';

const ENTRY_CODE = (process.env.PIRATES_SECURITY_CODE || 'Pirates102').trim().toLowerCase();
const ADMIN_CODE = (process.env.PIRATES_ADMIN_CODE || '#Pirateswinners1').trim().toLowerCase();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = typeof body?.code === 'string' ? body.code.trim().toLowerCase() : '';
    const valid = code && (code === ENTRY_CODE || code === ADMIN_CODE);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }
    const token = createCodeToken();
    const isAdmin = code === ADMIN_CODE;
    return NextResponse.json({ ok: true, token, isAdmin });
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}

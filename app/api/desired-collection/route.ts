import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readDesiredCollectionValue, writeDesiredCollectionValue } from '@/lib/desired-collection';

export const dynamic = 'force-dynamic';

export async function GET() {
  const value = await readDesiredCollectionValue();
  return NextResponse.json(
    { value },
    { headers: { 'Cache-Control': 'no-store, must-revalidate' } },
  );
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_admin')?.value !== 'true') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const raw = typeof body?.value === 'string' ? body.value.trim() : String(body?.value ?? '0');
    const num = parseFloat(raw);
    const nextValue = isNaN(num) ? '0.00' : num.toFixed(2);
    await writeDesiredCollectionValue(nextValue);
    return NextResponse.json({ value: nextValue });
  } catch {
    const value = await readDesiredCollectionValue();
    return NextResponse.json({ value });
  }
}

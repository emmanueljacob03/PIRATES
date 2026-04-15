import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const STORE_PATH = path.join(process.cwd(), '.data', 'desired-collection.json');

async function readValue() {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as { value?: string };
    const value = typeof parsed.value === 'string' ? parsed.value : '0.00';
    return value;
  } catch {
    return '0.00';
  }
}

async function writeValue(value: string) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify({ value }, null, 2), 'utf8');
}

export async function GET() {
  const value = await readValue();
  return NextResponse.json(
    { value },
    { headers: { 'Cache-Control': 'no-store, must-revalidate' } },
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const value = typeof body?.value === 'string' ? body.value.trim() : String(body?.value ?? '0');
    const num = parseFloat(value);
    const nextValue = isNaN(num) ? '0.00' : num.toFixed(2);
    await writeValue(nextValue);
    return NextResponse.json({ value: nextValue });
  } catch {
    const value = await readValue();
    return NextResponse.json({ value });
  }
}

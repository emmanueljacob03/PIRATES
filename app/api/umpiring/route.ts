import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

// In-memory fallback when DB is not available (e.g. demo)
const memoryDuties: { id: string; who: string; duty_date: string; notes: string }[] = [];
function nextId() {
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await (supabase as any).from('umpiring_duties').select('*').order('duty_date');
    if (!error && Array.isArray(data)) return NextResponse.json(data);
  } catch {
    // fallback to memory
  }
  return NextResponse.json(memoryDuties);
}

export async function POST(req: NextRequest) {
  let body: { who?: string; duty_date?: string; notes?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const who = typeof body.who === 'string' ? body.who.trim() : '';
  const duty_date = typeof body.duty_date === 'string' ? body.duty_date : new Date().toISOString().slice(0, 10);
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  if (!who) return NextResponse.json({ error: 'Who is required' }, { status: 400 });

  try {
    const supabase = await createServerSupabase();
    const { data, error } = await (supabase as any).from('umpiring_duties').insert({ who, duty_date, notes }).select().single();
    if (!error && data) return NextResponse.json(data);
  } catch {
    // fallback to memory
  }
  const duty = { id: nextId(), who, duty_date, notes };
  memoryDuties.push(duty);
  return NextResponse.json(duty);
}

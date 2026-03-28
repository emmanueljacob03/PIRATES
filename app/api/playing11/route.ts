import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database';
import { isWithinPlaying11VisibilityWindow } from '@/lib/app-timezone';
import { REQUIRED_PLAYING11_COUNT } from '@/lib/playing11-config';
import { scorecardDisplayName } from '@/lib/player-display-name';

function parseMatchId(raw: string | null): string | null {
  const id = (raw ?? '').trim();
  return id ? id : null;
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const codeVerified = cookieStore.get('pirates_code_verified')?.value === 'true';
  if (!codeVerified) {
    return NextResponse.json({ error: 'Team code required' }, { status: 403 });
  }

  const matchId = parseMatchId(req.nextUrl.searchParams.get('matchId'));
  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 });

  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  try {
    const { data: matchRow, error: matchErr } = await (supabase as any)
      .from('matches')
      .select('id, date, time, opponent')
      .eq('id', matchId)
      .single();

    if (matchErr || !matchRow) {
      return NextResponse.json({ error: matchErr?.message ?? 'Match not found' }, { status: 404 });
    }

    const isPractice = String(matchRow.opponent || '').toLowerCase().includes('practice');

    const { data: players, error: playersErr } = await (supabase as any)
      .from('players')
      .select('id, name, jersey_number, profile_id')
      .order('jersey_number');

    if (playersErr) {
      return NextResponse.json({ error: playersErr.message }, { status: 400 });
    }

    type PRow = { id: string; name: string; jersey_number: number | null; profile_id: string | null };
    const plist = (players ?? []) as PRow[];
    const profileIds = Array.from(
      new Set(plist.map((p) => p.profile_id).filter((id): id is string => id != null && id !== '')),
    );
    const profileNameById = new Map<string, string | null>();
    if (profileIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, name').in('id', profileIds);
      for (const row of profs ?? []) {
        const r = row as { id: string; name: string | null };
        profileNameById.set(r.id, r.name);
      }
    }

    const { data: lineup, error: lineupErr } = await (supabase as any)
      .from('match_playing11')
      .select('player_id, role')
      .eq('match_id', matchId);

    if (lineupErr) {
      return NextResponse.json({ error: lineupErr.message }, { status: 400 });
    }

    const roleByPlayer = new Map<string, 'playing11' | 'extra'>();
    (lineup ?? []).forEach((r: { player_id: string; role: string }) => {
      if (r.role === 'playing11' || r.role === 'extra') roleByPlayer.set(r.player_id, r.role);
    });

    const lineupVisible = isWithinPlaying11VisibilityWindow(
      String(matchRow.date),
      matchRow.time,
      new Date(),
    );

    return NextResponse.json({
      match: {
        id: matchRow.id,
        date: matchRow.date,
        time: matchRow.time,
        opponent: matchRow.opponent,
        is_practice: isPractice,
      },
      /** False once we are past match start + 4h (Central); clients should hide lineup. */
      lineup_visible: lineupVisible,
      players: plist.map((p) => ({
        id: p.id,
        name: scorecardDisplayName(p.name, p.profile_id ? profileNameById.get(p.profile_id) ?? null : null, p.profile_id),
        jersey_number: p.jersey_number ?? 0,
        role: lineupVisible ? (roleByPlayer.get(p.id) ?? null) : null,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get('pirates_admin')?.value === 'true';
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const body: { matchId?: string; playingIds?: string[]; extraIds?: string[] } = await req.json().catch(() => ({}));
  const matchId = (body.matchId ?? '').trim();
  const playingIds = Array.isArray(body.playingIds) ? body.playingIds : [];
  const extraIds = Array.isArray(body.extraIds) ? body.extraIds : [];

  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 });
  if (playingIds.length !== REQUIRED_PLAYING11_COUNT) {
    return NextResponse.json(
      { error: `Playing 11 must be exactly ${REQUIRED_PLAYING11_COUNT} players.` },
      { status: 400 },
    );
  }

  const playingSet = new Set(playingIds);
  const extraSet = new Set(extraIds.filter((id) => !playingSet.has(id)));

  const supabase = createAdminSupabase();

  try {
    const { data: matchRow, error: matchErr } = await (supabase as any)
      .from('matches')
      .select('id, opponent')
      .eq('id', matchId)
      .single();

    if (matchErr || !matchRow) {
      return NextResponse.json({ error: matchErr?.message ?? 'Match not found' }, { status: 404 });
    }

    const isPractice = String(matchRow.opponent || '').toLowerCase().includes('practice');
    if (isPractice) {
      return NextResponse.json({ error: 'Cannot set Playing 11 for practice matches.' }, { status: 400 });
    }

    // Replace existing lineup for this match.
    const { error: delErr } = await (supabase as any).from('match_playing11').delete().eq('match_id', matchId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

    const rowsToInsert: { match_id: string; player_id: string; role: string }[] = [];
    playingIds.forEach((pid) => rowsToInsert.push({ match_id: matchId, player_id: pid, role: 'playing11' }));
    Array.from(extraSet).forEach((pid) => rowsToInsert.push({ match_id: matchId, player_id: pid, role: 'extra' }));

    if (rowsToInsert.length > 0) {
      const { error: insErr } = await (supabase as any).from('match_playing11').insert(rowsToInsert);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}


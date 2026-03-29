import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabase } from '@/lib/supabase-admin';

const MATCH_STATS_OPTIONAL_COLUMN_ERROR_RE =
  /fours|sixes|include_bat|include_bowl|include_field|maidens|schema cache/i;

function isMissingOptionalMatchStatsColumnsError(message: string): boolean {
  return MATCH_STATS_OPTIONAL_COLUMN_ERROR_RE.test(message);
}

type StatPayload = {
  id?: string;
  player_id: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  overs: number;
  maidens: number;
  wickets: number;
  runs_conceded: number;
  catches: number;
  runouts: number;
  mvp: boolean;
  include_bat: boolean;
  include_bowl: boolean;
  include_field: boolean;
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const cookieStore = await cookies();
  if (cookieStore.get('pirates_admin')?.value !== 'true') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const resolved = await Promise.resolve(context.params);
  const matchId = resolved.id?.trim();
  if (!matchId) {
    return NextResponse.json({ error: 'Match id required' }, { status: 400 });
  }

  let body: { rows?: StatPayload[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rows = body.rows;
  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: 'rows array required' }, { status: 400 });
  }

  try {
    const supabase = createAdminSupabase();
    const selectedPlayerIds = new Set(rows.map((r) => r.player_id));

    const { data: existingForMatch, error: fetchErr } = await supabase
      .from('match_stats')
      .select('id, player_id')
      .eq('match_id', matchId);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 400 });
    }

    const existingList = (existingForMatch ?? []) as { id: string; player_id: string }[];
    const toDelete = existingList.filter((s) => !selectedPlayerIds.has(s.player_id));
    for (const del of toDelete) {
      const { error: delErr } = await supabase.from('match_stats').delete().eq('id', del.id);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });
    }

    let savedWithLegacyColumnsOnly = false;

    for (const row of rows) {
      const mvp = row.mvp ?? false;
      const payload = {
        match_id: matchId,
        player_id: row.player_id,
        runs: row.runs,
        balls: row.balls,
        fours: row.fours,
        sixes: row.sixes,
        overs: row.overs,
        maidens: row.maidens,
        wickets: row.wickets,
        runs_conceded: row.runs_conceded,
        catches: row.catches,
        runouts: row.runouts,
        mvp,
        include_bat: row.include_bat,
        include_bowl: row.include_bowl,
        include_field: row.include_field,
      };
      const legacy = {
        match_id: matchId,
        player_id: row.player_id,
        runs: row.runs,
        balls: row.balls,
        overs: row.overs,
        wickets: row.wickets,
        runs_conceded: row.runs_conceded,
        catches: row.catches,
        runouts: row.runouts,
        mvp,
      };

      if (row.id) {
        let { error: upErr } = await (supabase as any).from('match_stats').update(payload).eq('id', row.id);
        if (upErr && isMissingOptionalMatchStatsColumnsError(upErr.message)) {
          const retry = await (supabase as any).from('match_stats').update(legacy).eq('id', row.id);
          upErr = retry.error;
          if (!upErr) savedWithLegacyColumnsOnly = true;
        }
        if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
      } else {
        let { error: upErr } = await (supabase as any).from('match_stats').upsert(payload, {
          onConflict: 'match_id,player_id',
        });
        if (upErr && isMissingOptionalMatchStatsColumnsError(upErr.message)) {
          const retry = await (supabase as any).from('match_stats').upsert(legacy, {
            onConflict: 'match_id,player_id',
          });
          upErr = retry.error;
          if (!upErr) savedWithLegacyColumnsOnly = true;
        }
        if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true, legacyColumnsOnly: savedWithLegacyColumnsOnly });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json(
        { error: 'Server needs SUPABASE_SERVICE_ROLE_KEY in .env.local to save scorecards.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

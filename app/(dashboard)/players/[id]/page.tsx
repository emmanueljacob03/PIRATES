import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { format, parseISO, isValid } from 'date-fns';
import { createServerSupabase } from '@/lib/supabase-server';
import { scorecardDisplayName } from '@/lib/player-display-name';
import { getPlayerCardBack } from '@/lib/player-card-bio';
import { dutyScheduledStartMs, isUmpiringDutyCompleted } from '@/lib/umpiring-duties';
import ModeAccessBadge from '@/components/ModeAccessBadge';

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let player: {
    id: string;
    name: string;
    photo: string | null;
    jersey_number: number | null;
    role: string;
    profile_id: string | null;
  } | null = null;
  let displayName = '';
  let profileContact: { name: string | null; email: string; phone: string | null } | null = null;
  let rosterAccessLabel: string | null = null;
  let totals = { runs: 0, balls: 0, overs: 0, wickets: 0, runs_conceded: 0, catches: 0, runouts: 0, mvpAwards: 0 };
  let matchesPlayed = 0;
  let highestScore = 0;
  let strikeRate = 0;
  let economy = 0;
  let umpiringDuties: {
    id: string;
    who: string;
    duty_date: string;
    duty_time: string | null;
    notes: string | null;
  }[] = [];

  try {
    const supabase = await createServerSupabase();
    const { data: playerRow } = await supabase.from('players').select('*').eq('id', id).single();
    if (!playerRow) notFound();
    player = playerRow as {
      id: string;
      name: string;
      photo: string | null;
      jersey_number: number | null;
      role: string;
      profile_id: string | null;
    };

    if (player.profile_id) {
      const { data: pr } = await supabase
        .from('profiles')
        .select('name, email, phone, role')
        .eq('id', player.profile_id)
        .maybeSingle();
      if (pr) {
        const p = pr as { name: string | null; email: string; phone: string | null; role?: string };
        profileContact = p;
        rosterAccessLabel = p.role === 'admin' ? 'ADMIN: READ & WRITE' : 'VIEWER';
        displayName = scorecardDisplayName(player.name, p.name, player.profile_id);
      } else {
        displayName = scorecardDisplayName(player.name, null, player.profile_id);
      }
    } else {
      displayName = scorecardDisplayName(player.name, null, null);
    }

    const nameNorm = (player.name ?? '').trim().toLowerCase();
    const { data: sameNamePlayers } = await supabase.from('players').select('id, name');
    const idsForName =
      nameNorm.length > 0
        ? (sameNamePlayers ?? [])
            .filter((p: { name: string }) => (p.name ?? '').trim().toLowerCase() === nameNorm)
            .map((p: { id: string }) => p.id)
        : [id];
    const statPlayerIds = idsForName.length > 0 ? idsForName : [id];

    const { data: statsData } = await supabase.from('match_stats').select('*').in('player_id', statPlayerIds);
    type StatRow = { runs?: number; balls?: number; overs?: number; wickets?: number; runs_conceded?: number; catches?: number; runouts?: number; mvp?: boolean };
    const stats = (statsData ?? []) as StatRow[];

    type Totals = { runs: number; balls: number; overs: number; wickets: number; runs_conceded: number; catches: number; runouts: number; mvpAwards: number };
    const initial: Totals = { runs: 0, balls: 0, overs: 0, wickets: 0, runs_conceded: 0, catches: 0, runouts: 0, mvpAwards: 0 };
    totals = stats.reduce<Totals>(
      (acc, s) => ({
        runs: acc.runs + (s.runs ?? 0),
        balls: acc.balls + (s.balls ?? 0),
        overs: acc.overs + (s.overs ?? 0),
        wickets: acc.wickets + (s.wickets ?? 0),
        runs_conceded: acc.runs_conceded + (s.runs_conceded ?? 0),
        catches: acc.catches + (s.catches ?? 0),
        runouts: acc.runouts + (s.runouts ?? 0),
        mvpAwards: acc.mvpAwards + (s.mvp ? 1 : 0),
      }),
      initial
    );
    matchesPlayed = stats.length;
    strikeRate = totals.balls > 0 ? (totals.runs / totals.balls) * 100 : 0;
    economy = totals.overs > 0 ? totals.runs_conceded / totals.overs : 0;
    const highScoreRow = [...stats].sort((a, b) => (b.runs ?? 0) - (a.runs ?? 0))[0];
    highestScore = highScoreRow?.runs ?? 0;

    try {
      const pl = player;
      const { data: uall } = await supabase
        .from('umpiring_duties')
        .select('id, who, duty_date, duty_time, notes, player_id');
      const pn = (pl.name ?? '').trim().toLowerCase();
      umpiringDuties = (uall ?? [])
        .filter(
          (d: { player_id?: string | null; who?: string }) =>
            d.player_id === pl.id ||
            (!d.player_id && pn.length > 0 && (d.who ?? '').toLowerCase().includes(pn)),
        )
        .map((d: { id: string; who: string; duty_date: string; duty_time?: string | null; notes?: string | null }) => ({
          id: d.id,
          who: d.who,
          duty_date: d.duty_date,
          duty_time: d.duty_time ?? null,
          notes: d.notes ?? null,
        }))
        .sort(
          (a, b) =>
            dutyScheduledStartMs(a.duty_date, a.duty_time) - dutyScheduledStartMs(b.duty_date, b.duty_time),
        );
    } catch {
      umpiringDuties = [];
    }
  } catch {
    notFound();
  }

  if (!player) notFound();

  const cardBack = getPlayerCardBack(displayName, player.role);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <Link href="/players" className="text-amber-400 hover:underline text-sm inline-block">
          ← Back to Players
        </Link>
        {rosterAccessLabel && <ModeAccessBadge label={rosterAccessLabel} />}
      </div>
      <div className="card max-w-2xl">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="w-32 h-32 relative rounded-lg overflow-hidden bg-slate-700 flex-shrink-0">
            {player.photo ? (
              <Image src={player.photo} alt={displayName} fill className="object-cover" sizes="128px" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl">🏏</div>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{displayName}</h2>
            {player.jersey_number != null && <p className="text-pirate-gold">Jersey #{player.jersey_number}</p>}
            <p className="text-slate-400">Role: {cardBack.role}</p>
            {cardBack.records.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-slate-300 list-none pl-0">
                {cardBack.records.map((r, i) => (
                  <li
                    key={i}
                    className={
                      r.tier === 'strong'
                        ? 'font-semibold text-[var(--pirate-yellow)]'
                        : r.tier === 'accent'
                          ? 'text-slate-200'
                          : 'text-slate-400'
                    }
                  >
                    {r.text}
                  </li>
                ))}
              </ul>
            ) : null}
            {profileContact && (
              <div className="mt-4 pt-4 border-t border-slate-600 space-y-1 text-sm">
                <p className="text-slate-500 uppercase text-xs tracking-wide">Account / contact</p>
                {profileContact.name && <p className="text-slate-300">Profile name: {profileContact.name}</p>}
                <p className="text-slate-300">Email: {profileContact.email}</p>
                {profileContact.phone && <p className="text-slate-300">Phone: {profileContact.phone}</p>}
              </div>
            )}
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard label="Matches Played" value={String(matchesPlayed)} />
          <StatCard label="Total Runs" value={String(totals.runs)} />
          <StatCard label="Highest Score" value={String(highestScore)} />
          <StatCard label="Strike Rate" value={totals.balls > 0 ? strikeRate.toFixed(1) : '—'} />
          <StatCard label="Overs Bowled" value={String(totals.overs)} />
          <StatCard label="Wickets" value={String(totals.wickets)} />
          <StatCard label="Economy" value={totals.overs > 0 ? economy.toFixed(1) : '—'} />
          <StatCard label="Catches" value={String(totals.catches)} />
          <StatCard label="Run Outs" value={String(totals.runouts)} />
          <StatCard label="MVP Awards" value={String(totals.mvpAwards)} />
        </div>

        <div className="mt-8 border-t border-slate-600 pt-6">
          <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--pirate-yellow)' }}>
            Umpiring duties
          </h3>
          {umpiringDuties.length === 0 ? (
            <p className="text-slate-500 text-sm">No duties assigned.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {umpiringDuties.map((d) => {
                const done = isUmpiringDutyCompleted(d.duty_date, d.duty_time);
                const t = (d.duty_time || '12:00').trim();
                let dateStr = d.duty_date;
                try {
                  const x = parseISO(d.duty_date.slice(0, 10));
                  dateStr = isValid(x) ? format(x, 'MMM d, yyyy') : d.duty_date;
                } catch {
                  /* keep */
                }
                return (
                  <li key={d.id} className="text-slate-300">
                    <span className="text-white">
                      {dateStr} at {t}
                      {done && (
                        <span className="ml-2 inline-block rounded px-2 py-0.5 text-xs font-medium bg-emerald-900/60 text-emerald-300">
                          Completed
                        </span>
                      )}
                    </span>
                    {d.notes ? (
                      <span className="block text-slate-400 mt-1">Note (admin): {d.notes}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-700/50 rounded-lg p-3">
      <p className="text-slate-400 text-xs">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

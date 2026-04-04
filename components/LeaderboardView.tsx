'use client';

import { useState } from 'react';
import Image from 'next/image';

type Row = {
  playerId: string;
  name: string;
  photoUrl?: string | null;
  runs: number;
  balls: number;
  wickets: number;
  overs: number;
  runs_conceded: number;
  catches: number;
  runouts: number;
  strikeRate: number;
  economy: number;
  battingPoints: number;
  bowlingPoints: number;
  fieldingPoints: number;
  points: number;
};

const INITIAL = 5;

const MEDALS: readonly string[] = ['🥇', '🥈', '🥉'];

function medalEmoji(rankIndex: number): string {
  return rankIndex >= 0 && rankIndex < 3 ? MEDALS[rankIndex] : '';
}

/** Full-row podium styling (rank 0 = 1st). */
function podiumRowClass(rankIndex: number): string {
  if (rankIndex === 0) {
    return 'border-b border-amber-400/60 bg-gradient-to-r from-amber-600/45 via-amber-500/30 to-amber-600/40 text-slate-50 shadow-[inset_0_1px_0_rgba(254,243,199,0.12)]';
  }
  if (rankIndex === 1) {
    return 'border-b border-slate-300/45 bg-gradient-to-r from-slate-500/35 via-slate-400/22 to-slate-500/30 text-slate-50';
  }
  if (rankIndex === 2) {
    return 'border-b border-amber-800/55 bg-gradient-to-r from-amber-900/50 via-orange-900/38 to-amber-900/45 text-amber-50';
  }
  return 'border-b border-slate-700/50';
}

function pointsCellClass(rankIndex: number): string {
  if (rankIndex <= 2) return 'font-semibold text-amber-200';
  return 'font-medium text-[var(--pirate-yellow)]';
}

function Section({ title, children, expanded, onToggle }: { title: string; children: React.ReactNode; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {children}
      <button type="button" onClick={onToggle} className="mt-2 text-sm text-[var(--pirate-yellow)] hover:underline">
        {expanded ? 'Show less' : 'View more'}
      </button>
    </div>
  );
}

export default function LeaderboardView({
  bestBatsman,
  bestBowler,
  bestFielder,
  mvp,
}: {
  bestBatsman: Row[];
  bestBowler: Row[];
  bestFielder: Row[];
  mvp: Row[];
}) {
  const [expand, setExpand] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setExpand((e) => ({ ...e, [k]: !e[k] }));

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <Section title="Batting" expanded={!!expand.bat} onToggle={() => toggle('bat')}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-600">
              <th className="pb-2">#</th>
              <th className="pb-2">Player</th>
              <th className="pb-2">Pts</th>
              <th className="pb-2">Runs</th>
              <th className="pb-2">SR</th>
            </tr>
          </thead>
          <tbody>
            {(expand.bat ? bestBatsman : bestBatsman.slice(0, INITIAL)).map((p, i) => (
              <tr key={p.playerId} className={podiumRowClass(i)}>
                <td className="py-2 font-medium tabular-nums">{i + 1}</td>
                <td className="py-2 min-w-0 max-w-[11rem] sm:max-w-[15rem]">
                  <span className="inline-flex items-center gap-1 min-w-0 max-w-full truncate" title={p.name}>
                    <span className="truncate">{p.name}</span>
                    {medalEmoji(i) ? (
                      <span className="shrink-0 text-base" aria-hidden>
                        {medalEmoji(i)}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className={`py-2 ${pointsCellClass(i)}`}>{p.battingPoints}</td>
                <td className="py-2 tabular-nums">{p.runs}</td>
                <td className="py-2 tabular-nums">{p.strikeRate.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Bowling" expanded={!!expand.bowl} onToggle={() => toggle('bowl')}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-600">
              <th className="pb-2">#</th>
              <th className="pb-2">Player</th>
              <th className="pb-2">Pts</th>
              <th className="pb-2">Wickets</th>
              <th className="pb-2">Econ</th>
            </tr>
          </thead>
          <tbody>
            {(expand.bowl ? bestBowler : bestBowler.slice(0, INITIAL)).map((p, i) => (
              <tr key={p.playerId} className={podiumRowClass(i)}>
                <td className="py-2 font-medium tabular-nums">{i + 1}</td>
                <td className="py-2 min-w-0 max-w-[11rem] sm:max-w-[15rem]">
                  <span className="inline-flex items-center gap-1 min-w-0 max-w-full truncate" title={p.name}>
                    <span className="truncate">{p.name}</span>
                    {medalEmoji(i) ? (
                      <span className="shrink-0 text-base" aria-hidden>
                        {medalEmoji(i)}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className={`py-2 ${pointsCellClass(i)}`}>{p.bowlingPoints}</td>
                <td className="py-2 tabular-nums">{p.wickets}</td>
                <td className="py-2 tabular-nums">{p.economy.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Fielding" expanded={!!expand.field} onToggle={() => toggle('field')}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-600">
              <th className="pb-2">#</th>
              <th className="pb-2">Player</th>
              <th className="pb-2">Pts</th>
              <th className="pb-2">Catches</th>
              <th className="pb-2">Run outs</th>
            </tr>
          </thead>
          <tbody>
            {(expand.field ? bestFielder : bestFielder.slice(0, INITIAL)).map((p, i) => (
              <tr key={p.playerId} className={podiumRowClass(i)}>
                <td className="py-2 font-medium tabular-nums">{i + 1}</td>
                <td className="py-2 min-w-0 max-w-[11rem] sm:max-w-[15rem]">
                  <span className="inline-flex items-center gap-1 min-w-0 max-w-full truncate" title={p.name}>
                    <span className="truncate">{p.name}</span>
                    {medalEmoji(i) ? (
                      <span className="shrink-0 text-base" aria-hidden>
                        {medalEmoji(i)}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className={`py-2 ${pointsCellClass(i)}`}>{p.fieldingPoints}</td>
                <td className="py-2 tabular-nums">{p.catches}</td>
                <td className="py-2 tabular-nums">{p.runouts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="MVP (season points)" expanded={!!expand.mvp} onToggle={() => toggle('mvp')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[420px]">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-600">
                <th className="pb-2">#</th>
                <th className="pb-2">Player</th>
                <th className="pb-2">Bat</th>
                <th className="pb-2">Bowl</th>
                <th className="pb-2">Field</th>
                <th className="pb-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {(expand.mvp ? mvp : mvp.slice(0, INITIAL)).map((p, i) => (
                <tr key={p.playerId} className={podiumRowClass(i)}>
                  <td className="py-2 font-medium tabular-nums">{i + 1}</td>
                  <td className="py-2 min-w-0 max-w-[14rem] sm:max-w-[18rem]">
                    <span className="inline-flex items-center gap-2 min-w-0 max-w-full">
                      <span
                        className={`relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-slate-700 ${i <= 2 ? 'ring-2 ring-amber-300/50' : ''}`}
                      >
                        {p.photoUrl ? (
                          <Image src={p.photoUrl} alt="" fill className="object-cover" sizes="28px" />
                        ) : null}
                      </span>
                      <span className="min-w-0 truncate font-medium" title={p.name}>
                        {p.name}
                      </span>
                      {medalEmoji(i) ? (
                        <span className="shrink-0 text-base" aria-hidden>
                          {medalEmoji(i)}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="py-2 tabular-nums">{p.battingPoints}</td>
                  <td className="py-2 tabular-nums">{p.bowlingPoints}</td>
                  <td className="py-2 tabular-nums">{p.fieldingPoints}</td>
                  <td className={`py-2 font-semibold tabular-nums ${pointsCellClass(i)}`}>{p.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

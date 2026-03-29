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
              <tr key={p.playerId} className="border-b border-slate-700/50">
                <td className="py-2">{i + 1}</td>
                <td className="py-2 min-w-0 max-w-[11rem] sm:max-w-[15rem]">
                  <span className="block truncate" title={p.name}>
                    {p.name}
                  </span>
                </td>
                <td className="py-2 font-medium text-[var(--pirate-yellow)]">{p.battingPoints}</td>
                <td className="py-2">{p.runs}</td>
                <td className="py-2">{p.strikeRate.toFixed(1)}</td>
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
              <tr key={p.playerId} className="border-b border-slate-700/50">
                <td className="py-2">{i + 1}</td>
                <td className="py-2 min-w-0 max-w-[11rem] sm:max-w-[15rem]">
                  <span className="block truncate" title={p.name}>
                    {p.name}
                  </span>
                </td>
                <td className="py-2 font-medium text-[var(--pirate-yellow)]">{p.bowlingPoints}</td>
                <td className="py-2">{p.wickets}</td>
                <td className="py-2">{p.economy.toFixed(1)}</td>
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
              <tr key={p.playerId} className="border-b border-slate-700/50">
                <td className="py-2">{i + 1}</td>
                <td className="py-2 min-w-0 max-w-[11rem] sm:max-w-[15rem]">
                  <span className="block truncate" title={p.name}>
                    {p.name}
                  </span>
                </td>
                <td className="py-2 font-medium text-[var(--pirate-yellow)]">{p.fieldingPoints}</td>
                <td className="py-2">{p.catches}</td>
                <td className="py-2">{p.runouts}</td>
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
                <tr key={p.playerId} className="border-b border-slate-700/50">
                  <td className="py-2">{i + 1}</td>
                  <td className="py-2 min-w-0 max-w-[14rem] sm:max-w-[18rem]">
                    <span className="inline-flex items-center gap-2 min-w-0 max-w-full">
                      <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-slate-700">
                        {p.photoUrl ? (
                          <Image src={p.photoUrl} alt="" fill className="object-cover" sizes="28px" />
                        ) : null}
                      </span>
                      <span className="min-w-0 truncate font-medium" title={p.name}>
                        {p.name}
                      </span>
                    </span>
                  </td>
                  <td className="py-2">{p.battingPoints}</td>
                  <td className="py-2">{p.bowlingPoints}</td>
                  <td className="py-2">{p.fieldingPoints}</td>
                  <td className="py-2 font-semibold text-[var(--pirate-yellow)]">{p.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

'use client';

import { useState } from 'react';

type Row = {
  playerId: string;
  name: string;
  runs: number;
  balls: number;
  wickets: number;
  overs: number;
  runs_conceded: number;
  catches: number;
  runouts: number;
  strikeRate: number;
  economy: number;
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
  bestFielder: (Row & { fieldPoints: number })[];
  mvp: Row[];
}) {
  const [expand, setExpand] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setExpand((e) => ({ ...e, [k]: !e[k] }));

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <Section title="Best Batsman (Runs)" expanded={!!expand.bat} onToggle={() => toggle('bat')}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-600">
              <th className="pb-2">#</th>
              <th className="pb-2">Player</th>
              <th className="pb-2">Runs</th>
              <th className="pb-2">SR</th>
            </tr>
          </thead>
          <tbody>
            {(expand.bat ? bestBatsman : bestBatsman.slice(0, INITIAL)).map((p, i) => (
              <tr key={p.playerId} className="border-b border-slate-700/50">
                <td className="py-2">{i + 1}</td>
                <td className="py-2">{p.name}</td>
                <td className="py-2">{p.runs}</td>
                <td className="py-2">{p.strikeRate.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Best Bowler (Wickets)" expanded={!!expand.bowl} onToggle={() => toggle('bowl')}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-600">
              <th className="pb-2">#</th>
              <th className="pb-2">Player</th>
              <th className="pb-2">Wickets</th>
              <th className="pb-2">Econ</th>
            </tr>
          </thead>
          <tbody>
            {(expand.bowl ? bestBowler : bestBowler.slice(0, INITIAL)).map((p, i) => (
              <tr key={p.playerId} className="border-b border-slate-700/50">
                <td className="py-2">{i + 1}</td>
                <td className="py-2">{p.name}</td>
                <td className="py-2">{p.wickets}</td>
                <td className="py-2">{p.economy.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Best Fielder (Catches + Run outs)" expanded={!!expand.field} onToggle={() => toggle('field')}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-600">
              <th className="pb-2">#</th>
              <th className="pb-2">Player</th>
              <th className="pb-2">Catches</th>
              <th className="pb-2">Run outs</th>
            </tr>
          </thead>
          <tbody>
            {(expand.field ? bestFielder : bestFielder.slice(0, INITIAL)).map((p, i) => (
              <tr key={p.playerId} className="border-b border-slate-700/50">
                <td className="py-2">{i + 1}</td>
                <td className="py-2">{p.name}</td>
                <td className="py-2">{p.catches}</td>
                <td className="py-2">{p.runouts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="MVP (Points)" expanded={!!expand.mvp} onToggle={() => toggle('mvp')}>
        <p className="text-slate-400 text-xs mb-2">
          Batting: 3 pts / 10 runs + Bowling: 2 pts / wicket + Fielding: catches + run outs
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-600">
              <th className="pb-2">#</th>
              <th className="pb-2">Player</th>
              <th className="pb-2">Points</th>
            </tr>
          </thead>
          <tbody>
            {(expand.mvp ? mvp : mvp.slice(0, INITIAL)).map((p, i) => (
              <tr key={p.playerId} className="border-b border-slate-700/50">
                <td className="py-2">{i + 1}</td>
                <td className="py-2">{p.name}</td>
                <td className="py-2">{p.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

type Player = { id: string; name: string };
type StatRow = {
  id?: string;
  player_id: string;
  runs: number;
  balls: number;
  overs: number;
  wickets: number;
  runs_conceded: number;
  catches: number;
  runouts: number;
  mvp: boolean;
};

export default function ScorecardForm({
  matchId,
  players,
  existingStats,
  isAdmin,
}: {
  matchId: string;
  players: Player[];
  existingStats: { id: string; player_id: string; runs: number; balls: number; overs: number; wickets: number; runs_conceded: number; catches: number; runouts: number; mvp: boolean }[];
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<StatRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string>('');
  const [ocrInfo, setOcrInfo] = useState<string>('');

  const [batting1, setBatting1] = useState<File | null>(null);
  const [batting2, setBatting2] = useState<File | null>(null);
  const [bowling1, setBowling1] = useState<File | null>(null);
  const [fielding1, setFielding1] = useState<File | null>(null);
  const [fielding2, setFielding2] = useState<File | null>(null);

  function normalizeName(s: string) {
    return (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function extractNumbers(snippet: string) {
    const matches = snippet.match(/\d+\.\d+|\d+/g);
    return matches ? matches.map((n) => Number(n)) : [];
  }

  function findSnippet(text: string, playerName: string) {
    const t = text.toLowerCase();
    const name = normalizeName(playerName);
    if (!name) return null;
    const parts = name.split(' ').filter((p) => p.length >= 3);
    const last = parts[parts.length - 1];
    const first = parts[0];
    const idx = last ? t.indexOf(last) : -1;
    const idx2 = idx >= 0 ? idx : first ? t.indexOf(first) : -1;
    if (idx2 < 0) return null;
    return text.slice(Math.max(0, idx2 - 25), Math.min(text.length, idx2 + 220));
  }

  async function runOcrAndFill() {
    if (!isAdmin) return;
    setOcrError('');
    setOcrInfo('');

    const hasAnyBatting = !!batting1 || !!batting2;
    const hasAnyFielding = !!fielding1 || !!fielding2;

    if (!hasAnyBatting || !hasAnyFielding) {
      setOcrError('Please upload at least 1 batting image and at least 1 fielding image.');
      return;
    }

    setOcrLoading(true);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');

      const ocrOne = async (f: File | null) => {
        if (!f) return '';
        const res = await worker.recognize(f);
        return (res?.data?.text ?? '').toString();
      };

      const [b1, b2, bw, f1, f2] = await Promise.all([
        ocrOne(batting1),
        ocrOne(batting2),
        ocrOne(bowling1),
        ocrOne(fielding1),
        ocrOne(fielding2),
      ]);

      const battingText = [b1, b2].filter(Boolean).join('\n');
      const bowlingText = bw ? bw : '';
      const fieldingText = [f1, f2].filter(Boolean).join('\n');

      await worker.terminate();

      const detectedRows: StatRow[] = [];

      players.forEach((p) => {
        const batSnippet = battingText ? findSnippet(battingText, p.name) : null;
        const bowlSnippet = bowlingText ? findSnippet(bowlingText, p.name) : null;
        const fieldSnippet = fieldingText ? findSnippet(fieldingText, p.name) : null;

        const foundAny = !!batSnippet || !!bowlSnippet || !!fieldSnippet;
        if (!foundAny) return;

        const row: StatRow = {
          player_id: p.id,
          runs: 0,
          balls: 0,
          overs: 0,
          wickets: 0,
          runs_conceded: 0,
          catches: 0,
          runouts: 0,
          mvp: false,
        };

        // Batting: assume snippet numbers start with RUNS then BALLS
        if (batSnippet) {
          const nums = extractNumbers(batSnippet);
          if (nums.length >= 2) {
            row.runs = Math.max(0, Math.round(nums[0]));
            row.balls = Math.max(0, Math.round(nums[1]));
          }
        }

        // Bowling: assume snippet numbers order ~ [overs, M, runsConceded, wickets]
        if (bowlSnippet) {
          const nums = extractNumbers(bowlSnippet);
          if (nums.length >= 4) {
            const oversDot = Math.max(0, Number(nums[0]));
            const runsConceded = Math.max(0, Math.round(nums[2]));
            const wickets = Math.max(0, Math.round(nums[3]));
            row.overs = Number.isFinite(oversDot) ? oversDot : 0;
            row.runs_conceded = runsConceded;
            row.wickets = wickets;
          }
        }

        // Fielding: assume snippet numbers order ~ [catches, runouts]
        if (fieldSnippet) {
          const nums = extractNumbers(fieldSnippet);
          if (nums.length >= 2) {
            row.catches = Math.max(0, Math.round(nums[0]));
            row.runouts = Math.max(0, Math.round(nums[1]));
          }
        }

        detectedRows.push(row);
      });

      if (detectedRows.length === 0) {
        setOcrError('OCR did not detect any player names from these images. Please upload clearer images or correct the player list in the filters.');
        return;
      }

      setRows(detectedRows);
      setOcrInfo(`OCR finished. Detected ${detectedRows.length} players. Please review and manually correct if needed.`);
    } catch (e: unknown) {
      setOcrError((e as Error).message || 'OCR failed');
    } finally {
      setOcrLoading(false);
    }
  }

  useEffect(() => {
    if (existingStats.length > 0) {
      setRows(
        existingStats.map((s) => ({
          id: s.id,
          player_id: s.player_id,
          runs: s.runs ?? 0,
          balls: s.balls ?? 0,
          overs: s.overs ?? 0,
          wickets: s.wickets ?? 0,
          runs_conceded: s.runs_conceded ?? 0,
          catches: s.catches ?? 0,
          runouts: s.runouts ?? 0,
          mvp: s.mvp ?? false,
        }))
      );
    } else {
      // Start empty: OCR will detect which players actually played,
      // and admins can correct that list in the filters section.
      setRows([]);
    }
  }, [players, existingStats]);

  async function handleSave() {
    setSaving(true);
    try {
      const selectedPlayerIds = new Set(rows.map((r) => r.player_id));

      // Remove any old match_stats rows for players that are no longer included
      const { data: existingForMatch } = await supabase
        .from('match_stats')
        .select('id, player_id')
        .eq('match_id', matchId);

      const existingList = (existingForMatch ?? []) as { id: string; player_id: string }[];
      const toDelete = existingList.filter((s) => !selectedPlayerIds.has(s.player_id));
      for (const del of toDelete) {
        await supabase.from('match_stats').delete().eq('id', del.id);
      }

      for (const row of rows) {
        const payload = {
          match_id: matchId,
          player_id: row.player_id,
          runs: row.runs,
          balls: row.balls,
          overs: row.overs,
          wickets: row.wickets,
          runs_conceded: row.runs_conceded,
          catches: row.catches,
          runouts: row.runouts,
          mvp: row.mvp,
        };
        if (row.id) {
          // @ts-expect-error Supabase client generic inference
          await supabase.from('match_stats').update(payload).eq('id', row.id);
        } else {
          // @ts-expect-error Supabase client generic inference
          await supabase.from('match_stats').upsert(payload, {
            onConflict: 'match_id,player_id',
          });
        }
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function updateRow(playerId: string, field: keyof StatRow, value: number | boolean) {
    setRows((prev) =>
      prev.map((r) =>
        r.player_id === playerId ? { ...r, [field]: value } : r
      )
    );
  }

  function togglePlayer(playerId: string, checked: boolean) {
    setRows((prev) => {
      if (checked) {
        if (prev.some((r) => r.player_id === playerId)) return prev;
        return [
          ...prev,
          {
            player_id: playerId,
            runs: 0,
            balls: 0,
            overs: 0,
            wickets: 0,
            runs_conceded: 0,
            catches: 0,
            runouts: 0,
            mvp: false,
          },
        ];
      }
      return prev.filter((r) => r.player_id !== playerId);
    });
  }

  function cricketOversDotToReal(oversDot: number) {
    // oversDot is stored in dot-overs format: 1.1 = 1 over + 1 ball (7 balls total)
    const wholeOvers = Math.floor(oversDot);
    const ballsDigitRaw = Math.round((oversDot - wholeOvers) * 10);
    const ballsDigit = Math.max(0, Math.min(5, ballsDigitRaw));
    const totalBalls = wholeOvers * 6 + ballsDigit;
    return totalBalls / 6;
  }

  function computeEconomy(oversDot: number, runsConceded: number) {
    if (!oversDot || oversDot <= 0) return 0;
    const realOvers = cricketOversDotToReal(oversDot);
    if (realOvers <= 0) return 0;
    return runsConceded / realOvers;
  }

  async function handleDeleteStat(id: string) {
    if (!isAdmin) return;
    try {
      await (supabase as any).from('match_stats').delete().eq('id', id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } catch {}
  }

  if (players.length === 0) {
    return <p className="text-slate-500">Add players first from the Players page.</p>;
  }

  return (
    <div>
      {isAdmin && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-3">Upload scorecard images (OCR first)</h3>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-300 font-medium mb-2">Batting scorecards (2 images)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="file" accept="image/*" capture="environment" className="input-field text-xs" onChange={(e) => setBatting1(e.target.files?.[0] ?? null)} />
                <input type="file" accept="image/*" capture="environment" className="input-field text-xs" onChange={(e) => setBatting2(e.target.files?.[0] ?? null)} />
              </div>
            </div>

            <div>
              <p className="text-sm text-slate-300 font-medium mb-2">Bowling scoreboard (1 image)</p>
              <input type="file" accept="image/*" capture="environment" className="input-field text-xs" onChange={(e) => setBowling1(e.target.files?.[0] ?? null)} />
            </div>

            <div>
              <p className="text-sm text-slate-300 font-medium mb-2">Fielding scoreboard (2 images)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="file" accept="image/*" capture="environment" className="input-field text-xs" onChange={(e) => setFielding1(e.target.files?.[0] ?? null)} />
                <input type="file" accept="image/*" capture="environment" className="input-field text-xs" onChange={(e) => setFielding2(e.target.files?.[0] ?? null)} />
              </div>
            </div>

            {ocrError && <p className="text-sm text-red-400">{ocrError}</p>}
            {ocrInfo && <p className="text-sm text-amber-300">{ocrInfo}</p>}

            {/*
              OCR is allowed when you have at least 1 batting image AND at least 1 fielding image.
              Bowling image is optional; OCR will just skip bowling stats if it's missing.
            */}

            <button
              type="button"
              onClick={runOcrAndFill}
              className="btn-primary"
              disabled={
                ocrLoading ||
                saving ||
                (!batting1 && !batting2) ||
                (!fielding1 && !fielding2)
              }
            >
              {ocrLoading ? 'Reading images…' : 'Fill Stats (OCR)'}
            </button>

            <p className="text-xs text-slate-400">
              OCR may not be perfect. Please review and manually correct the numbers below before saving.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-3">Players (who played)</h3>
          <p className="text-xs text-slate-400 mb-3">
            After OCR this list is auto-generated. If something is wrong, correct it here.
          </p>
          <div className="flex flex-wrap gap-3">
            {players.map((p) => {
              const selected = rows.some((r) => r.player_id === p.id);
              return (
                <label key={p.id} className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={!isAdmin}
                    onChange={(e) => togglePlayer(p.id, e.target.checked)}
                  />
                  <span className={selected ? 'text-white' : ''}>{p.name}</span>
                </label>
              );
            })}
          </div>
          {rows.length === 0 && <p className="text-xs text-slate-400 mt-3">No players selected yet.</p>}
        </div>

        <section className="card overflow-x-auto">
          <h3 className="text-lg font-semibold mb-3">Batting</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-600">
                <th className="pb-2 pr-4">Player</th>
                <th className="pb-2 pr-2 w-16">R</th>
                <th className="pb-2 pr-2 w-16">B</th>
                <th className="pb-2 pr-2 w-20">SR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const playerName = players.find((p) => p.id === r.player_id)?.name ?? r.player_id;
                const sr = r.balls > 0 ? (r.runs / r.balls) * 100 : 0;
                return (
                  <tr key={r.player_id} className="border-b border-slate-700/50">
                    <td className="py-2 pr-4 font-medium">{playerName}</td>
                    <td className="py-2">
                      <input
                        type="number"
                        min="0"
                        className="input-field w-16 py-1 text-center"
                        value={r.runs}
                        disabled={!isAdmin}
                        onChange={(e) => updateRow(r.player_id, 'runs', parseInt(e.target.value, 10) || 0)}
                      />
                    </td>
                    <td className="py-2">
                      <input
                        type="number"
                        min="0"
                        className="input-field w-16 py-1 text-center"
                        value={r.balls}
                        disabled={!isAdmin}
                        onChange={(e) => updateRow(r.player_id, 'balls', parseInt(e.target.value, 10) || 0)}
                      />
                    </td>
                    <td className="py-2">{sr.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="card overflow-x-auto">
          <h3 className="text-lg font-semibold mb-3">Bowling</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-600">
                <th className="pb-2 pr-4">Player</th>
                <th className="pb-2 pr-2 w-20">O</th>
                <th className="pb-2 pr-2 w-28">Runs conc.</th>
                <th className="pb-2 pr-2 w-16">W</th>
                <th className="pb-2 pr-2 w-24">Econ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const playerName = players.find((p) => p.id === r.player_id)?.name ?? r.player_id;
                const econ = computeEconomy(r.overs, r.runs_conceded);
                return (
                  <tr key={r.player_id} className="border-b border-slate-700/50">
                    <td className="py-2 pr-4 font-medium">{playerName}</td>
                    <td className="py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        className="input-field w-20 py-1 text-center"
                        value={r.overs}
                        disabled={!isAdmin}
                        onChange={(e) => updateRow(r.player_id, 'overs', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="py-2">
                      <input
                        type="number"
                        min="0"
                        className="input-field w-28 py-1 text-center"
                        value={r.runs_conceded}
                        disabled={!isAdmin}
                        onChange={(e) => updateRow(r.player_id, 'runs_conceded', parseInt(e.target.value, 10) || 0)}
                      />
                    </td>
                    <td className="py-2">
                      <input
                        type="number"
                        min="0"
                        className="input-field w-16 py-1 text-center"
                        value={r.wickets}
                        disabled={!isAdmin}
                        onChange={(e) => updateRow(r.player_id, 'wickets', parseInt(e.target.value, 10) || 0)}
                      />
                    </td>
                    <td className="py-2">{econ.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="card overflow-x-auto">
          <h3 className="text-lg font-semibold mb-3">Fielding</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-600">
                <th className="pb-2 pr-4">Player</th>
                <th className="pb-2 pr-2 w-24">Catches</th>
                <th className="pb-2 pr-2 w-24">Run outs</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const playerName = players.find((p) => p.id === r.player_id)?.name ?? r.player_id;
                return (
                  <tr key={r.player_id} className="border-b border-slate-700/50">
                    <td className="py-2 pr-4 font-medium">{playerName}</td>
                    <td className="py-2">
                      <input
                        type="number"
                        min="0"
                        className="input-field w-24 py-1 text-center"
                        value={r.catches}
                        disabled={!isAdmin}
                        onChange={(e) => updateRow(r.player_id, 'catches', parseInt(e.target.value, 10) || 0)}
                      />
                    </td>
                    <td className="py-2">
                      <input
                        type="number"
                        min="0"
                        className="input-field w-24 py-1 text-center"
                        value={r.runouts}
                        disabled={!isAdmin}
                        onChange={(e) => updateRow(r.player_id, 'runouts', parseInt(e.target.value, 10) || 0)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <button
          type="button"
          onClick={handleSave}
          className="btn-primary mt-4"
          disabled={saving || rows.length === 0}
        >
          {saving ? 'Saving...' : 'Save Scorecard'}
        </button>
      </div>
    </div>
  );
}

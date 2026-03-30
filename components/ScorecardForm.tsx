'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { bestBattingFromSnippet, buildBattingOcrSnippet } from '@/lib/batting-ocr';
import { bestBowlingFromSnippet, buildBowlingOcrSnippet } from '@/lib/bowling-ocr';
import { findLineForPlayer } from '@/lib/scorecard-ocr-match';
import { dotOversFromNumberInput, formatDotOversForInput, normalizeDotOversInput } from '@/lib/cricket-overs';
import {
  battingPointsContributed,
  bowlingPointsContributed,
  fieldingPointsContributed,
  totalPointsContributed,
} from '@/lib/cricket-points';

type Player = { id: string; name: string };
type StatRow = {
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

function withMatchStatsSchemaHint(message: string): string {
  if (
    /fours|sixes|include_bat|include_bowl|include_field|maidens|schema cache/i.test(message)
  ) {
    return `${message} If you manage Supabase: open the SQL Editor and run the script alter_match_stats_scorecard_columns_bundle.sql from this project (adds fours, sixes, role flags, maidens). Wait a minute for the schema cache to refresh, then save again.`;
  }
  return message;
}

function rowPointsInput(r: StatRow) {
  return {
    runs: r.runs,
    balls: r.balls,
    fours: r.fours,
    sixes: r.sixes,
    overs: r.overs,
    maidens: r.maidens,
    wickets: r.wickets,
    runs_conceded: r.runs_conceded,
    catches: r.catches,
    runouts: r.runouts,
    include_bat: r.include_bat,
    include_bowl: r.include_bowl,
    include_field: r.include_field,
  };
}

export default function ScorecardForm({
  matchId,
  players,
  existingStats,
  prefillPlayerIds,
  isAdmin,
}: {
  matchId: string;
  players: Player[];
  prefillPlayerIds?: string[] | null;
  existingStats: {
    id: string;
    player_id: string;
    runs: number;
    balls: number;
    fours?: number;
    sixes?: number;
    overs: number;
    maidens?: number;
    wickets: number;
    runs_conceded: number;
    catches: number;
    runouts: number;
    mvp: boolean;
    include_bat?: boolean;
    include_bowl?: boolean;
    include_field?: boolean;
  }[];
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<StatRow[]>([]);
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  const prefillKey = prefillPlayerIds?.length ? prefillPlayerIds.join(',') : '';

  const rowsInFormOrder = useMemo(() => {
    const idx = new Map(players.map((p, i) => [p.id, i]));
    return [...rows].sort((a, b) => (idx.get(a.player_id) ?? 9999) - (idx.get(b.player_id) ?? 9999));
  }, [rows, players]);

  const battingRows = useMemo(
    () => rowsInFormOrder.filter((r) => r.include_bat),
    [rowsInFormOrder],
  );
  const bowlingRows = useMemo(
    () => rowsInFormOrder.filter((r) => r.include_bowl),
    [rowsInFormOrder],
  );
  const fieldingRows = useMemo(
    () => rowsInFormOrder.filter((r) => r.include_field),
    [rowsInFormOrder],
  );

  const [saving, setSaving] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string>('');
  const [ocrInfo, setOcrInfo] = useState<string>('');
  const [saveError, setSaveError] = useState<string>('');
  const [saveWarning, setSaveWarning] = useState<string>('');

  const [batting1, setBatting1] = useState<File | null>(null);
  const [batting2, setBatting2] = useState<File | null>(null);
  const [bowling1, setBowling1] = useState<File | null>(null);

  const serverStatsKey = useMemo(
    () =>
      JSON.stringify(
        existingStats.map((s) => ({
          id: s.id,
          player_id: s.player_id,
          runs: s.runs,
          balls: s.balls,
          fours: s.fours,
          sixes: s.sixes,
          overs: s.overs,
          maidens: s.maidens,
          wickets: s.wickets,
          runs_conceded: s.runs_conceded,
          catches: s.catches,
          runouts: s.runouts,
          mvp: s.mvp,
          include_bat: s.include_bat,
          include_bowl: s.include_bowl,
          include_field: s.include_field,
        })),
      ),
    [existingStats],
  );

  const playersOrderKey = useMemo(() => players.map((p) => `${p.id}:${p.name}`).join('|'), [players]);

  /** Keep section toggles on if that section has non-zero stats (avoids “empty tables” after save). */
  function normalizeRowForPersist(r: StatRow): StatRow {
    let include_bat = r.include_bat;
    let include_bowl = r.include_bowl;
    let include_field = r.include_field;
    if (r.runs > 0 || r.balls > 0 || r.fours > 0 || r.sixes > 0) include_bat = true;
    if (r.overs > 0 || r.maidens > 0 || r.wickets > 0 || r.runs_conceded > 0) include_bowl = true;
    if (r.catches > 0 || r.runouts > 0) include_field = true;
    if (!include_bat && !include_bowl && !include_field) {
      include_bat = true;
      include_bowl = true;
      include_field = true;
    }
    return {
      ...r,
      overs: normalizeDotOversInput(r.overs),
      include_bat,
      include_bowl,
      include_field,
    };
  }

  function emptyRow(playerId: string): StatRow {
    return {
      player_id: playerId,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      overs: 0,
      maidens: 0,
      wickets: 0,
      runs_conceded: 0,
      catches: 0,
      runouts: 0,
      mvp: false,
      include_bat: true,
      include_bowl: true,
      include_field: true,
    };
  }

  async function runOcrRead() {
    if (!isAdmin) return;
    setOcrError('');
    setOcrInfo('');
    const hasBat = !!(batting1 || batting2);
    const hasBowl = !!bowling1;
    if (!hasBat && !hasBowl) {
      setOcrError('Upload at least one batting or bowling image, then click Read.');
      return;
    }

    setOcrLoading(true);
    try {
      const { createWorker, PSM } = await import('tesseract.js');
      const worker = await createWorker('eng');
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        user_defined_dpi: '300',
      });
      const ocrOne = async (f: File | null) => {
        if (!f) return '';
        const res = await worker.recognize(f);
        return (res?.data?.text ?? '').toString();
      };
      /** Bowling tables read cleaner in column mode (1.0/5.00 stay parsed; less 40/500 glue). */
      const [b1, b2] = await Promise.all([ocrOne(batting1), ocrOne(batting2)]);
      let bw = '';
      if (bowling1) {
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_COLUMN,
          user_defined_dpi: '300',
        });
        bw = await ocrOne(bowling1);
      }
      await worker.terminate();
      const battingText = [b1, b2].filter(Boolean).join('\n');
      const bowlingText = bw || '';

      const toLines = (text: string) => {
        const raw = text ? text.split(/\n/).map((l) => l.trim()).filter(Boolean) : [];
        if (raw.length > 0) return raw;
        const t = text.replace(/\s+/g, ' ').trim();
        return t ? [t] : [];
      };

      const battingLines = hasBat ? toLines(battingText) : [];
      const bowlingLines = hasBowl ? toLines(bowlingText) : [];

      const claimedBat = new Set<number>();
      const claimedBowl = new Set<number>();
      const playersBySpecificity = [...players].sort((a, b) => b.name.length - a.name.length);

      let fillBat = 0;
      let fillBowl = 0;
      let nameHits = 0;
      let statsApplied = false;

      const prev = rowsRef.current;
      const map = new Map(prev.map((r) => [r.player_id, { ...r }]));

      for (const p of playersBySpecificity) {
          const batHit = hasBat && battingLines.length ? findLineForPlayer(battingLines, p.name, claimedBat) : null;
          if (batHit) claimedBat.add(batHit.lineIndex);
          const batSnippet =
            batHit && hasBat && battingLines.length
              ? buildBattingOcrSnippet(battingLines, batHit.lineIndex, claimedBat)
              : null;

        const bowlHit = hasBowl && bowlingLines.length ? findLineForPlayer(bowlingLines, p.name, claimedBowl) : null;
        if (bowlHit) claimedBowl.add(bowlHit.lineIndex);
        const bowlSnippet =
          bowlHit && hasBowl && bowlingLines.length
            ? buildBowlingOcrSnippet(bowlingLines, bowlHit.lineIndex, claimedBowl)
            : null;

        if (!batSnippet?.trim() && !bowlSnippet?.trim()) continue;

        nameHits += 1;

        let row = map.get(p.id);
        if (!row) {
          row = {
            ...emptyRow(p.id),
            include_bat: false,
            include_bowl: false,
            include_field: false,
          };
        }

        let appliedHere = false;

        if (batSnippet) {
          const parsed = bestBattingFromSnippet(batSnippet);
          if (parsed && (parsed.runs > 0 || parsed.balls > 0)) {
            row.runs = parsed.runs;
            row.balls = parsed.balls;
            row.fours = parsed.fours;
            row.sixes = parsed.sixes;
            row.include_bat = true;
            fillBat += 1;
            statsApplied = true;
            appliedHere = true;
          }
        }

        if (bowlSnippet) {
          const parsed = bestBowlingFromSnippet(bowlSnippet);
          if (
            parsed &&
            (parsed.overs > 0 || parsed.wickets > 0 || parsed.runs_conceded > 0 || parsed.maidens > 0)
          ) {
            row.overs = normalizeDotOversInput(parsed.overs);
            row.maidens = parsed.maidens;
            row.runs_conceded = parsed.runs_conceded;
            row.wickets = parsed.wickets;
            row.include_bowl = true;
            fillBowl += 1;
            statsApplied = true;
            appliedHere = true;
          }
        }

        const wasOnCard = prev.some((r) => r.player_id === p.id);
        if (appliedHere || wasOnCard) {
          map.set(p.id, row);
        }
      }

      if (nameHits === 0) {
        setOcrError(
          'Read did not match any names to this squad list. Use the same names as the scorecard and Playing XI.',
        );
        return;
      }

      if (!statsApplied) {
        setOcrInfo(
          `Found ${nameHits} player name(s) on the image but could not read stat columns. Try a sharper photo, zoom the table, or enter scores manually.`,
        );
        return;
      }

      const order = new Map(players.map((pl, i) => [pl.id, i]));
      setRows(
        Array.from(map.values()).sort(
          (a, b) => (order.get(a.player_id) ?? 9999) - (order.get(b.player_id) ?? 9999),
        ),
      );

      const parts: string[] = [];
      if (hasBat) parts.push(`batting ${fillBat}`);
      if (hasBowl) parts.push(`bowling ${fillBowl}`);
      setOcrInfo(`Updated ${parts.join(' · ')} row(s). Review points and save.`);
    } catch (e: unknown) {
      setOcrError((e as Error).message || 'OCR failed');
    } finally {
      setOcrLoading(false);
    }
  }

  useEffect(() => {
    const order = new Map(players.map((p, i) => [p.id, i]));
    if (existingStats.length > 0) {
      const mapped = existingStats.map((s) =>
        normalizeRowForPersist({
          id: s.id,
          player_id: s.player_id,
          runs: s.runs ?? 0,
          balls: s.balls ?? 0,
          fours: s.fours ?? 0,
          sixes: s.sixes ?? 0,
          overs: Number(s.overs ?? 0),
          maidens: s.maidens ?? 0,
          wickets: s.wickets ?? 0,
          runs_conceded: s.runs_conceded ?? 0,
          catches: s.catches ?? 0,
          runouts: s.runouts ?? 0,
          mvp: s.mvp ?? false,
          include_bat: s.include_bat !== false,
          include_bowl: s.include_bowl !== false,
          include_field: s.include_field !== false,
        }),
      );
      setRows(
        [...mapped].sort(
          (a, b) => (order.get(a.player_id) ?? 9999) - (order.get(b.player_id) ?? 9999),
        ),
      );
    } else if (prefillPlayerIds && prefillPlayerIds.length > 0) {
      setRows(prefillPlayerIds.map((id) => emptyRow(id)));
    } else {
      setRows([]);
    }
  }, [serverStatsKey, playersOrderKey, prefillKey]);

  function computeMatchMvpFlags(sortedRows: StatRow[]): Map<string, boolean> {
    const m = new Map<string, boolean>();
    let bestId: string | null = null;
    let best = -1;
    for (const r of sortedRows) {
      const pts = totalPointsContributed(rowPointsInput(r));
      if (pts > best) {
        best = pts;
        bestId = r.player_id;
      }
    }
    if (best <= 0) bestId = null;
    for (const r of sortedRows) {
      m.set(r.player_id, bestId != null && r.player_id === bestId);
    }
    return m;
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    setSaveWarning('');
    try {
      const normalized = rows.map((r) => normalizeRowForPersist(r));
      const order = new Map(players.map((p, i) => [p.id, i]));
      const sortedForMvp = [...normalized].sort(
        (a, b) => (order.get(a.player_id) ?? 9999) - (order.get(b.player_id) ?? 9999),
      );
      const mvpByPlayer = computeMatchMvpFlags(sortedForMvp);

      const rowsPayload = normalized.map((r) => ({
        ...r,
        mvp: mvpByPlayer.get(r.player_id) ?? false,
      }));

      const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rowsPayload }),
      });

      let data: { error?: string; legacyColumnsOnly?: boolean } = {};
      try {
        data = await res.json();
      } catch {
        /* empty */
      }

      if (!res.ok) {
        setSaveError(withMatchStatsSchemaHint(data.error || 'Save failed'));
        return;
      }

      if (data.legacyColumnsOnly) {
        setSaveWarning(
          'Saved core batting/bowling/fielding numbers only. Fours, sixes, maidens, and Bat/Bowl/Field toggles were not written because those columns are missing or not in PostgREST’s schema cache. Run supabase/alter_match_stats_scorecard_columns_bundle.sql in the Supabase SQL Editor, wait a minute, then save again to persist everything.',
        );
      }

      setRows(rowsPayload);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function updateRow(playerId: string, field: keyof StatRow, value: number | boolean) {
    setRows((prev) =>
      prev.map((r) => (r.player_id === playerId ? { ...r, [field]: value } : r)),
    );
  }

  function addPlayerToCard(playerId: string) {
    setRows((prev) => {
      if (prev.some((r) => r.player_id === playerId)) return prev;
      return [...prev, emptyRow(playerId)];
    });
  }

  function removePlayerFromCard(playerId: string) {
    setRows((prev) => prev.filter((r) => r.player_id !== playerId));
  }

  function cricketOversDotToReal(oversDot: number) {
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

  if (players.length === 0) {
    return <p className="text-slate-500">Add players first from the Players page.</p>;
  }

  return (
    <div>
      {isAdmin && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-3">Scorecard screenshots (OCR)</h3>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-300 font-medium mb-2">Batting</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="input-field text-xs"
                  onChange={(e) => setBatting1(e.target.files?.[0] ?? null)}
                />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="input-field text-xs"
                  onChange={(e) => setBatting2(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div>
              <p className="text-sm text-slate-300 font-medium mb-2">Bowling</p>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="input-field text-xs"
                onChange={(e) => setBowling1(e.target.files?.[0] ?? null)}
              />
            </div>

            {ocrError && <p className="text-sm text-red-400">{ocrError}</p>}
            {ocrInfo && <p className="text-sm text-amber-300">{ocrInfo}</p>}

            <button
              type="button"
              onClick={runOcrRead}
              className="btn-primary"
              disabled={ocrLoading || saving || (!batting1 && !batting2 && !bowling1)}
            >
              {ocrLoading ? 'Reading…' : 'Read'}
            </button>

            <p className="text-xs text-slate-400">
              One Read fills every uploaded sheet (batting and/or bowling). Enter catches and run outs manually under
              Field if needed. Names must match this match’s squad list.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-3">Players who played</h3>
          <p className="text-xs text-slate-400 mb-3">
            Add everyone who played (Playing XI + subs). Use Bat / Bowl / Field so each name appears only in the tables
            you need. Remove (×) drops them from all three; add again with + Add.
          </p>
          <ul className="space-y-2">
            {players.map((p) => {
              const row = rows.find((r) => r.player_id === p.id);
              if (!row) {
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                    <span className="font-medium text-white min-w-[8rem]">{p.name}</span>
                    <button
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => addPlayerToCard(p.id)}
                      className="text-xs px-2 py-1 rounded bg-slate-700 border border-slate-500 hover:bg-slate-600 disabled:opacity-40"
                    >
                      + Add
                    </button>
                  </li>
                );
              }
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm border-b border-slate-700/40 pb-2"
                >
                  <span className="font-medium text-white min-w-[8rem]">{p.name}</span>
                  <label className="flex items-center gap-1 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={row.include_bat}
                      disabled={!isAdmin}
                      onChange={(e) => updateRow(p.id, 'include_bat', e.target.checked)}
                    />
                    Bat
                  </label>
                  <label className="flex items-center gap-1 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={row.include_bowl}
                      disabled={!isAdmin}
                      onChange={(e) => updateRow(p.id, 'include_bowl', e.target.checked)}
                    />
                    Bowl
                  </label>
                  <label className="flex items-center gap-1 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={row.include_field}
                      disabled={!isAdmin}
                      onChange={(e) => updateRow(p.id, 'include_field', e.target.checked)}
                    />
                    Field
                  </label>
                  {isAdmin && (
                    <button
                      type="button"
                      title="Remove from scorecard (all sections)"
                      onClick={() => removePlayerFromCard(p.id)}
                      className="ml-auto text-slate-500 hover:text-red-400 text-lg leading-none px-1"
                      aria-label={`Remove ${p.name}`}
                    >
                      ×
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {rows.length === 0 && <p className="text-xs text-slate-400 mt-3">No players on the card yet — use + Add.</p>}
        </div>

        <section className="card overflow-x-auto">
          <h3 className="text-lg font-semibold mb-3">Batting</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-600">
                <th className="pb-2 pr-4">Player</th>
                <th className="pb-2 pr-2 w-16">R</th>
                <th className="pb-2 pr-2 w-16">B</th>
                <th className="pb-2 pr-2 w-14">4s</th>
                <th className="pb-2 pr-2 w-14">6s</th>
                <th className="pb-2 pr-2 w-20">SR</th>
                <th className="pb-2 w-14">Pts</th>
              </tr>
            </thead>
            <tbody>
              {battingRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-3 text-slate-500 text-xs">
                    No batting rows — tick Bat for players above.
                  </td>
                </tr>
              ) : (
                battingRows.map((r) => {
                  const playerName = players.find((p) => p.id === r.player_id)?.name ?? r.player_id;
                  const sr = r.balls > 0 ? (r.runs / r.balls) * 100 : 0;
                  const bp = battingPointsContributed(rowPointsInput(r));
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
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          className="input-field w-14 py-1 text-center"
                          value={r.fours}
                          disabled={!isAdmin}
                          onChange={(e) => updateRow(r.player_id, 'fours', parseInt(e.target.value, 10) || 0)}
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          className="input-field w-14 py-1 text-center"
                          value={r.sixes}
                          disabled={!isAdmin}
                          onChange={(e) => updateRow(r.player_id, 'sixes', parseInt(e.target.value, 10) || 0)}
                        />
                      </td>
                      <td className="py-2">{sr.toFixed(2)}</td>
                      <td className="py-2 text-amber-300 font-medium">{bp.toFixed(1)}</td>
                    </tr>
                  );
                })
              )}
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
                <th className="pb-2 pr-2 w-14">M</th>
                <th className="pb-2 pr-2 w-28">R</th>
                <th className="pb-2 pr-2 w-16">W</th>
                <th className="pb-2 pr-2 w-24">Econ</th>
                <th className="pb-2 w-14">Pts</th>
              </tr>
            </thead>
            <tbody>
              {bowlingRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-3 text-slate-500 text-xs">
                    No bowling rows — tick Bowl for players above.
                  </td>
                </tr>
              ) : (
                bowlingRows.map((r) => {
                  const playerName = players.find((p) => p.id === r.player_id)?.name ?? r.player_id;
                  const econ = computeEconomy(r.overs, r.runs_conceded);
                  const bwp = bowlingPointsContributed(rowPointsInput(r));
                  return (
                    <tr key={r.player_id} className="border-b border-slate-700/50">
                      <td className="py-2 pr-4 font-medium">{playerName}</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          className="input-field w-20 py-1 text-center"
                          title="Dot overs: 1.1 = 1 over + 1 ball (7 balls). 1.5 = 11 balls."
                          value={formatDotOversForInput(r.overs)}
                          disabled={!isAdmin}
                          onChange={(e) =>
                            updateRow(
                              r.player_id,
                              'overs',
                              dotOversFromNumberInput(r.overs, parseFloat(e.target.value) || 0),
                            )
                          }
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          className="input-field w-14 py-1 text-center"
                          value={r.maidens}
                          disabled={!isAdmin}
                          onChange={(e) => updateRow(r.player_id, 'maidens', parseInt(e.target.value, 10) || 0)}
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
                      <td className="py-2 text-amber-300 font-medium">{bwp.toFixed(1)}</td>
                    </tr>
                  );
                })
              )}
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
                <th className="pb-2 w-14">Pts</th>
              </tr>
            </thead>
            <tbody>
              {fieldingRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-slate-500 text-xs">
                    No fielding rows — tick Field for players above.
                  </td>
                </tr>
              ) : (
                fieldingRows.map((r) => {
                  const playerName = players.find((p) => p.id === r.player_id)?.name ?? r.player_id;
                  const fp = fieldingPointsContributed(rowPointsInput(r));
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
                      <td className="py-2 text-amber-300 font-medium">{fp.toFixed(1)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>

        {saveWarning && <p className="text-sm text-amber-300 mt-4">{saveWarning}</p>}
        {saveError && <p className="text-sm text-red-400 mt-4">{saveError}</p>}
        <button
          type="button"
          onClick={handleSave}
          className="btn-primary mt-4"
          disabled={saving || rows.length === 0}
        >
          {saving ? 'Saving...' : 'Save scorecard'}
        </button>
      </div>
    </div>
  );
}

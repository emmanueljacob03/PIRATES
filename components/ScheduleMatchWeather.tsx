'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Match } from '@/types/database';
import { weatherAdvisoryFromConditions, weatherFriendlyTipFromConditions } from '@/lib/weather-advisory';
import { weatherCityForScheduleGround } from '@/lib/schedule-grounds';

type WeatherState = {
  temp?: number;
  description?: string;
  main?: string | null;
  advisory?: string | null;
  friendlyTip?: string;
  forecastForMatch?: boolean;
  forecastHint?: string | null;
};

/** `matches.weather` JSON: temp is °C if unit === 'C'; legacy rows omit unit and are °F. */
function storedTempToCelsius(stored: {
  temp?: number;
  unit?: string;
} | null): number | null {
  const t = stored?.temp;
  if (t == null || !Number.isFinite(Number(t))) return null;
  const unit = stored?.unit ?? 'F';
  if (unit === 'C') return Number(t);
  return ((Number(t) - 32) * 5) / 9;
}

export default function ScheduleMatchWeather({ match }: { match: Match }) {
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  /**
   * `hover`: mouse on laptop — open on hover.
   * `tap`: `(pointer: coarse)` or no hover — tap to open/close (touch phones/tablets).
   */
  const [panelMode, setPanelMode] = useState<'hover' | 'tap'>('tap');
  const [mounted, setMounted] = useState(false);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => {
      const canHover = window.matchMedia('(hover: hover)').matches;
      const finePointer = window.matchMedia('(pointer: fine)').matches;
      const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
      // Coarse = finger/touch primary — always tap (mobile). Mouse laptops: fine + hover, no coarse.
      const hoverUi = canHover && finePointer && !coarsePointer;
      setPanelMode(hoverUi ? 'hover' : 'tap');
    };
    sync();
    const queries = ['(hover: hover)', '(pointer: fine)', '(pointer: coarse)'].map((q) =>
      window.matchMedia(q),
    );
    queries.forEach((mq) => mq.addEventListener('change', sync));
    return () => queries.forEach((mq) => mq.removeEventListener('change', sync));
  }, []);

  const stored = match.weather as {
    temp?: number;
    description?: string;
    main?: string;
    unit?: string;
  } | null;

  useEffect(() => {
    const tempC = storedTempToCelsius(stored);
    if (tempC != null) {
      const desc = stored?.description ?? '';
      const main = stored?.main ?? null;
      setWeather({
        temp: tempC,
        description: desc,
        main,
        advisory: weatherAdvisoryFromConditions(tempC, main) || null,
        friendlyTip: weatherFriendlyTipFromConditions(tempC, main, desc, null),
        forecastForMatch: false,
        forecastHint: null,
      });
      return;
    }
    setLoading(true);
    setLoadError(null);
    const city = weatherCityForScheduleGround(match.ground);
    const datePart = typeof match.date === 'string' ? match.date.slice(0, 10) : '';
    const timePart = (match.time || '12:00').trim();
    const qs = new URLSearchParams({ city });
    if (datePart) qs.set('date', datePart);
    if (timePart) qs.set('time', timePart);
    fetch(`/api/weather?${qs.toString()}`, { credentials: 'same-origin' })
      .then(async (r) => {
        const d = (await r.json()) as {
          error?: string;
          reason?: string;
          temp?: number;
          description?: string;
          main?: string | null;
          wind?: number;
          advisory?: string | null;
          friendlyTip?: string;
          forecastForMatch?: boolean;
          forecastHint?: string | null;
        };
        if (!r.ok || d.error) {
          const hint =
            r.status === 503 || d.reason === 'missing_env'
              ? 'Set OPENWEATHER_API_KEY in Vercel → Environment Variables (Production), redeploy, or add it to .env.local for local dev. Name must match exactly.'
              : d.error || `Weather request failed (${r.status}).`;
          setLoadError(hint);
          return;
        }
        setWeather({
          temp: d.temp,
          description: d.description ?? '',
          main: d.main ?? null,
          advisory: (d.advisory ?? weatherAdvisoryFromConditions(d.temp ?? null, d.main ?? null)) || null,
          friendlyTip:
            d.friendlyTip ??
            weatherFriendlyTipFromConditions(d.temp ?? null, d.main ?? null, d.description ?? null, d.wind ?? null),
          forecastForMatch: d.forecastForMatch,
          forecastHint: d.forecastHint ?? null,
        });
      })
      .catch(() =>
        setLoadError('Could not reach weather service. Check connection or try again.'),
      )
      .finally(() => setLoading(false));
  }, [match.ground, match.id, match.date, match.time, stored?.temp, stored?.unit, stored?.description, stored?.main]);

  const clearHide = useCallback(() => {
    if (hideRef.current) {
      clearTimeout(hideRef.current);
      hideRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHide();
    hideRef.current = setTimeout(() => setOpen(false), 220);
  }, [clearHide]);

  const handlePointerEnter = useCallback(() => {
    if (panelMode !== 'hover') return;
    clearHide();
    setOpen(true);
  }, [clearHide, panelMode]);

  const handlePointerLeave = useCallback(() => {
    if (panelMode !== 'hover') return;
    scheduleHide();
  }, [scheduleHide, panelMode]);

  const handleWeatherClick = useCallback(() => {
    if (panelMode === 'hover') return;
    setOpen((o) => !o);
  }, [panelMode]);

  const advisoryText = (weather?.advisory ?? '').trim();
  const friendlyText = (weather?.friendlyTip ?? '').trim();
  const tempRounded = weather?.temp != null ? Math.round(weather.temp) : null;
  const desc = (weather?.description ?? '').trim();
  const titleParts: string[] = [];
  if (tempRounded != null) titleParts.push(`${tempRounded}°C`);
  if (desc) titleParts.push(desc);
  if (advisoryText) titleParts.push(advisoryText);
  if (friendlyText) titleParts.push(friendlyText);
  const titleAttr = titleParts.length > 0 ? titleParts.join(' — ') : undefined;

  if (loading && !weather) {
    return (
      <p className="text-slate-500 text-sm mt-1" aria-live="polite">
        🌡 Loading weather…
      </p>
    );
  }

  if (loadError && !weather) {
    return (
      <p className="text-slate-400 text-sm mt-1 max-w-md leading-snug" role="alert">
        <span className="text-slate-200">Couldn&apos;t load weather for match time.</span>{' '}
        Bring layers, check the sky on game day, and stay hydrated.{' '}
        <span className="text-slate-500 text-xs block sm:inline sm:ml-1 mt-1 sm:mt-0">{loadError}</span>
      </p>
    );
  }

  if (!weather || tempRounded == null) {
    return null;
  }

  const showPanel = open && (advisoryText || friendlyText || tempRounded != null);

  const panelClassName =
    'p-3 rounded-lg bg-slate-800 border border-amber-500/40 shadow-xl text-sm text-amber-100 max-h-[min(55vh,360px)] overflow-y-auto';

  const panelInner = (
    <>
      <p className="text-white font-medium mb-1">
        {tempRounded}°C{desc ? ` · ${desc}` : ''}
        {weather?.forecastForMatch ? (
          <span className="text-slate-400 text-xs font-normal block mt-0.5">Forecast for scheduled match time</span>
        ) : null}
      </p>
      {weather?.forecastHint ? (
        <p className="text-slate-400 text-xs leading-snug mb-2">{weather.forecastHint}</p>
      ) : null}
      {advisoryText ? (
        <p className="text-amber-400 leading-snug mb-2">⚠ {advisoryText}</p>
      ) : null}
      <p className="text-slate-200/95 leading-snug text-sm">{friendlyText || 'Conditions look playable — stay sharp.'}</p>
    </>
  );

  const tapOverlay =
    mounted &&
    showPanel &&
    panelMode === 'tap' &&
    createPortal(
      <>
        <div
          className="fixed inset-0 z-[200] bg-black/40"
          aria-hidden
          onClick={() => setOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Weather details"
          className={`fixed left-4 right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[210] mx-auto w-auto max-w-lg ${panelClassName}`}
          onClick={(e) => e.stopPropagation()}
        >
          {panelInner}
        </div>
      </>,
      document.body,
    );

  return (
    <div
      className="relative z-0 mt-1 inline-block max-w-full overflow-visible"
      onMouseEnter={handlePointerEnter}
      onMouseLeave={handlePointerLeave}
    >
      <button
        type="button"
        className="text-left w-full sm:w-auto rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 touch-manipulation active:opacity-90 [-webkit-tap-highlight-color:transparent]"
        title={titleAttr}
        aria-expanded={open}
        aria-label={titleAttr ?? 'Weather'}
        onClick={handleWeatherClick}
      >
        <span
          className={`text-slate-300 text-sm border-b border-dotted border-slate-500 select-none ${
            panelMode === 'hover'
              ? 'cursor-help hover:border-amber-400/60'
              : 'cursor-pointer border-amber-500/40'
          }`}
        >
          🌡 {tempRounded}°C{desc ? ` · ${desc}` : ''}
          {weather?.forecastForMatch ? (
            <span className="text-slate-500 text-xs font-normal ml-1">(match time)</span>
          ) : null}
        </span>
      </button>
      {tapOverlay}
      {showPanel && panelMode === 'hover' && (
        <div
          className={`absolute left-0 top-full z-[100] mt-1 min-w-[220px] max-w-[min(100%,320px)] ${panelClassName}`}
          onMouseEnter={handlePointerEnter}
          onMouseLeave={handlePointerLeave}
        >
          {panelInner}
        </div>
      )}
    </div>
  );
}

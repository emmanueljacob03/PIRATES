'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Match } from '@/types/database';
import { weatherAdvisoryFromConditions } from '@/lib/weather-advisory';
import { weatherCityForScheduleGround } from '@/lib/schedule-grounds';

type WeatherState = {
  temp?: number;
  description?: string;
  main?: string | null;
  advisory?: string | null;
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
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stored = match.weather as {
    temp?: number;
    description?: string;
    main?: string;
    unit?: string;
  } | null;

  useEffect(() => {
    const tempC = storedTempToCelsius(stored);
    if (tempC != null) {
      setWeather({
        temp: tempC,
        description: stored?.description ?? '',
        main: stored?.main ?? null,
        advisory: weatherAdvisoryFromConditions(tempC, stored?.main ?? null) || null,
      });
      return;
    }
    setLoading(true);
    setLoadError(null);
    const city = weatherCityForScheduleGround(match.ground);
    fetch(`/api/weather?city=${encodeURIComponent(city)}`, { credentials: 'same-origin' })
      .then(async (r) => {
        const d = (await r.json()) as {
          error?: string;
          reason?: string;
          temp?: number;
          description?: string;
          main?: string | null;
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
          advisory: weatherAdvisoryFromConditions(d.temp ?? null, d.main ?? null) || null,
        });
      })
      .catch(() =>
        setLoadError('Could not reach weather service. Check connection or try again.'),
      )
      .finally(() => setLoading(false));
  }, [match.ground, match.id, stored?.temp, stored?.unit, stored?.description, stored?.main]);

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
    clearHide();
    setOpen(true);
  }, [clearHide]);

  const handlePointerLeave = useCallback(() => {
    scheduleHide();
  }, [scheduleHide]);

  const toggleTap = useCallback(() => {
    setOpen((o) => !o);
  }, []);

  const advisoryText = (weather?.advisory ?? '').trim();
  const tempRounded = weather?.temp != null ? Math.round(weather.temp) : null;
  const desc = (weather?.description ?? '').trim();
  const titleParts: string[] = [];
  if (tempRounded != null) titleParts.push(`${tempRounded}°C`);
  if (desc) titleParts.push(desc);
  if (advisoryText) titleParts.push(advisoryText);
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
      <p className="text-slate-500 text-sm mt-1 max-w-md leading-snug" role="alert">
        <span className="text-amber-300/90">Weather unavailable.</span>{' '}
        {loadError}
      </p>
    );
  }

  if (!weather || tempRounded == null) {
    return null;
  }

  return (
    <div
      className="relative mt-1 inline-block max-w-full"
      onMouseEnter={handlePointerEnter}
      onMouseLeave={handlePointerLeave}
    >
      <button
        type="button"
        className="text-left w-full sm:w-auto rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
        title={titleAttr}
        aria-expanded={open}
        aria-label={titleAttr ?? 'Weather'}
        onClick={toggleTap}
      >
        <span className="text-slate-300 text-sm cursor-help border-b border-dotted border-slate-500 hover:border-amber-400/60">
          🌡 {tempRounded}°C{desc ? ` · ${desc}` : ''}
        </span>
      </button>
      {open && advisoryText && (
        <div
          className="absolute left-0 top-full z-30 mt-1 min-w-[220px] max-w-[min(100%,320px)] p-3 rounded-lg bg-slate-800 border border-amber-500/40 shadow-xl text-sm text-amber-100"
          onMouseEnter={handlePointerEnter}
          onMouseLeave={handlePointerLeave}
        >
          <p className="text-white font-medium mb-1">
            {tempRounded}°C{desc ? ` · ${desc}` : ''}
          </p>
          <p className="text-amber-400 leading-snug">⚠ {advisoryText}</p>
        </div>
      )}
    </div>
  );
}

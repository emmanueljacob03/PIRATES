'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Match } from '@/types/database';
import { weatherAdvisoryFromConditions } from '@/lib/weather-advisory';

type WeatherState = {
  temp?: number;
  description?: string;
  main?: string | null;
  advisory?: string | null;
};

export default function ScheduleMatchWeather({ match }: { match: Match }) {
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stored = match.weather as { temp?: number; description?: string; main?: string } | null;

  useEffect(() => {
    if (stored?.temp != null && Number.isFinite(stored.temp)) {
      setWeather({
        temp: stored.temp,
        description: stored.description ?? '',
        main: stored.main ?? null,
        advisory:
          weatherAdvisoryFromConditions(stored.temp ?? null, stored.main ?? null) || null,
      });
      return;
    }
    setLoading(true);
    setError(false);
    const city = match.ground?.trim() || 'London';
    fetch(`/api/weather?city=${encodeURIComponent(city)}`)
      .then((r) => r.json())
      .then((d: { error?: string; temp?: number; description?: string; main?: string; advisory?: string }) => {
        if (d.error) {
          setError(true);
          return;
        }
        setWeather({
          temp: d.temp,
          description: d.description ?? '',
          main: d.main ?? null,
          advisory: weatherAdvisoryFromConditions(d.temp ?? null, d.main ?? null) || null,
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [match.ground, match.id, stored?.temp, stored?.description, stored?.main]);

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
  if (tempRounded != null) titleParts.push(`${tempRounded}°F`);
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

  if (error && !weather) {
    return (
      <p className="text-slate-500 text-sm mt-1">Weather unavailable (check OPENWEATHER_API_KEY).</p>
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
          🌡 {tempRounded}°F{desc ? ` · ${desc}` : ''}
        </span>
        <span className="text-slate-500 text-xs ml-1 hidden sm:inline">(hover)</span>
        <span className="text-slate-500 text-xs ml-1 sm:hidden">(tap for tips)</span>
      </button>
      {open && advisoryText && (
        <div
          className="absolute left-0 top-full z-30 mt-1 min-w-[220px] max-w-[min(100%,320px)] p-3 rounded-lg bg-slate-800 border border-amber-500/40 shadow-xl text-sm text-amber-100"
          onMouseEnter={handlePointerEnter}
          onMouseLeave={handlePointerLeave}
        >
          <p className="text-white font-medium mb-1">
            {tempRounded}°F{desc ? ` · ${desc}` : ''}
          </p>
          <p className="text-amber-400 leading-snug">⚠ {advisoryText}</p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useCallback, useRef } from 'react';
import type { Match } from '@/types/database';

const HIDE_DELAY_MS = 200;

export default function PracticeMatchHover({ match }: { match: Match }) {
  const [hover, setHover] = useState(false);
  const [weather, setWeather] = useState<{ temp?: number; description?: string; advisory?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadWeather = useCallback(() => {
    if (weather !== null || loading) return;
    setLoading(true);
    const city = match.ground || 'London';
    fetch(`/api/weather?city=${encodeURIComponent(city)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setWeather({ temp: d.temp, description: d.description, advisory: d.advisory });
      })
      .finally(() => setLoading(false));
  }, [match.ground, weather, loading]);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => setHover(false), HIDE_DELAY_MS);
  }, [clearHideTimeout]);

  const handleEnter = useCallback(() => {
    clearHideTimeout();
    setHover(true);
    loadWeather();
  }, [clearHideTimeout, loadWeather]);

  return (
    <div
      className="relative mt-1 inline-block"
      onMouseEnter={handleEnter}
      onMouseLeave={scheduleHide}
    >
      <p className="text-slate-400 text-sm cursor-help">
        🌡 Hover for weather
      </p>
      {hover && (
        <div
          className="absolute left-0 top-full mt-1 z-20 min-w-[200px] p-3 rounded-lg bg-slate-800 border border-slate-600 shadow-xl text-sm"
          onMouseEnter={handleEnter}
          onMouseLeave={scheduleHide}
        >
          {loading && !weather && <p className="text-slate-400">Loading weather…</p>}
          {weather && (
            <>
              <p className="text-white font-medium">
                {weather.temp != null ? `${Math.round(weather.temp)}°F` : '—'} {weather.description ?? ''}
              </p>
              {weather.advisory && (
                <p className="text-amber-400 mt-1">⚠ {weather.advisory}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

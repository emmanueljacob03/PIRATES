'use client';

import { useEffect, useState } from 'react';
import type { Match } from '@/types/database';

export default function MatchWeather({ match }: { match: Match }) {
  const [weather, setWeather] = useState<{ temp?: number; description?: string; advisory?: string } | null>(null);
  const weatherStored = match.weather as { temp?: number; description?: string } | null;

  useEffect(() => {
    if (weatherStored?.temp != null) {
      setWeather(weatherStored);
      return;
    }
    const city = match.ground || 'London';
    fetch(`/api/weather?city=${encodeURIComponent(city)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setWeather({ temp: d.temp, description: d.description, advisory: d.advisory });
      })
      .catch(() => {});
  }, [match.ground, match.id, weatherStored]);

  if (weather?.temp != null) {
    return (
      <p className="text-slate-400 text-sm mt-1">
        🌡 {Math.round(weather.temp)}°F {weather.description}
        {weather.advisory && ` · ${weather.advisory}`}
      </p>
    );
  }
  return null;
}

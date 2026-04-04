/**
 * Fixed schedule grounds: label stored on `matches.ground`, separate query for OpenWeather.
 */
export type ScheduleGround = {
  label: string;
  /** Passed to /api/weather ?city=… */
  weatherQuery: string;
};

export const SCHEDULE_GROUNDS: readonly ScheduleGround[] = [
  {
    label: 'PCG — Prairie Cricket Ground',
    weatherQuery: 'Prairie Village, KS, US',
  },
  {
    label: 'OCG — Olathe Cricket Ground',
    weatherQuery: 'Olathe, KS, US',
  },
  {
    label: 'Minor Park Cricket Ground',
    weatherQuery: 'Kansas City, MO, US',
  },
  {
    label: 'Stocksdale Park — Liberty',
    weatherQuery: 'Liberty, MO, US',
  },
  {
    label: 'Auburndale Park — Topeka',
    weatherQuery: 'Topeka, KS, US',
  },
] as const;

const WEATHER_BY_LABEL = new Map(SCHEDULE_GROUNDS.map((g) => [g.label, g.weatherQuery]));

/** OpenWeather city string for a stored ground label; unknown text uses itself (legacy rows). */
export function weatherCityForScheduleGround(ground: string | null | undefined): string {
  const t = ground?.trim() ?? '';
  if (!t) return 'London';
  return WEATHER_BY_LABEL.get(t) ?? t;
}

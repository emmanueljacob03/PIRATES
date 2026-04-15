import { NextRequest, NextResponse } from 'next/server';
import { dutyScheduledStartMs } from '@/lib/umpiring-duties';
import {
  weatherAdvisoryFromConditions,
  weatherFriendlyTipFromConditions,
} from '@/lib/weather-advisory';

type OwPayload = {
  cod?: number | string;
  message?: string;
  main?: { temp?: number };
  weather?: Array<{ description?: string; main?: string }>;
  wind?: { speed?: number };
};

type ForecastListItem = {
  dt: number;
  main?: { temp?: number };
  weather?: Array<{ description?: string; main?: string }>;
  wind?: { speed?: number };
};

function isCityNotFound(data: OwPayload | { cod?: number | string; message?: string }): boolean {
  const cod = data.cod;
  if (cod === 404 || cod === '404') return true;
  const m = String('message' in data ? data.message ?? '' : '').toLowerCase();
  return m.includes('not found');
}

function cityQueryAttempts(raw: string): string[] {
  const city = raw.trim();
  if (!city) return [];
  const attempts = [city];
  if (!city.includes(',')) attempts.push(`${city}, GB`);
  return Array.from(new Set(attempts));
}

function closestForecastItem(list: ForecastListItem[], targetMs: number): ForecastListItem | null {
  if (!list.length) return null;
  let best = list[0]!;
  let bestDelta = Infinity;
  for (const item of list) {
    const t = item.dt * 1000;
    const delta = Math.abs(t - targetMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = item;
    }
  }
  return best;
}

async function fetchCurrentWeather(
  apiKey: string,
  lat: string | null,
  lon: string | null,
  city: string | null,
): Promise<{ data: OwPayload; error?: string }> {
  const base = `https://api.openweathermap.org/data/2.5/weather?appid=${apiKey}&units=metric`;
  if (lat && lon) {
    const url = `${base}&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = (await res.json()) as OwPayload;
    return { data };
  }
  if (city?.trim()) {
    const attempts = cityQueryAttempts(city);
    let data: OwPayload = { cod: 0, message: 'Weather fetch failed' };
    for (const q of attempts) {
      const url = `${base}&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const attempt = (await res.json()) as OwPayload;
      data = attempt;
      const cod = attempt.cod;
      const ok = cod === 200 || cod === '200';
      if (ok) break;
      if (!isCityNotFound(attempt)) break;
    }
    return { data };
  }
  return { data: { cod: 400, message: 'No location' } };
}

async function fetchForecastList(
  apiKey: string,
  lat: string | null,
  lon: string | null,
  city: string | null,
): Promise<ForecastListItem[] | null> {
  const base = `https://api.openweathermap.org/data/2.5/forecast?appid=${apiKey}&units=metric`;
  if (lat && lon) {
    const url = `${base}&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = (await res.json()) as { cod?: number | string; list?: ForecastListItem[] };
    const ok = data.cod === 200 || data.cod === '200';
    if (!ok || !data.list?.length) return null;
    return data.list;
  }
  if (city?.trim()) {
    const attempts = cityQueryAttempts(city);
    for (const q of attempts) {
      const url = `${base}&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = (await res.json()) as { cod?: number | string; list?: ForecastListItem[] };
      const ok = data.cod === 200 || data.cod === '200';
      if (ok && data.list?.length) return data.list;
      if (!isCityNotFound(data)) break;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get('lat');
  const lon = req.nextUrl.searchParams.get('lon');
  const city = req.nextUrl.searchParams.get('city');
  const date = req.nextUrl.searchParams.get('date')?.trim().slice(0, 10) ?? '';
  const time = req.nextUrl.searchParams.get('time')?.trim() ?? '';

  const apiKey = process.env.OPENWEATHER_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Weather not configured', reason: 'missing_env' as const },
      { status: 503 },
    );
  }

  if (!lat && !lon && !city?.trim()) {
    return NextResponse.json({ error: 'Provide lat/lon or city' }, { status: 400 });
  }

  const wantMatchTime = Boolean(date && time);
  const targetMs = wantMatchTime ? dutyScheduledStartMs(date, time) : null;

  try {
    let temp: number | null = null;
    let main: string | null = null;
    let desc: string | null = null;
    let wind: number | null = null;
    let forecastForMatch = false;
    let forecastHint: string | null = null;

    if (wantMatchTime && targetMs != null) {
      const list = await fetchForecastList(apiKey, lat, lon, city);
      if (list && list.length > 0) {
        const firstT = list[0]!.dt * 1000;
        const lastT = list[list.length - 1]!.dt * 1000;
        const margin = 2 * 3600 * 1000;
        const inWindow = targetMs >= firstT - margin && targetMs <= lastT + margin;
        if (inWindow) {
          const best = closestForecastItem(list, targetMs);
          const t = best?.main?.temp ?? null;
          if (best && t != null && Number.isFinite(Number(t))) {
            temp = Number(t);
            main = best.weather?.[0]?.main ?? null;
            desc = best.weather?.[0]?.description ?? null;
            wind = best.wind?.speed != null && Number.isFinite(Number(best.wind.speed)) ? Number(best.wind.speed) : null;
            forecastForMatch = true;
          }
        } else if (targetMs > lastT + margin) {
          forecastHint =
            'Match is beyond the 5-day forecast window — showing current conditions; check again closer to game week.';
        } else {
          forecastHint = 'Showing current conditions for this location.';
        }
      } else if (wantMatchTime) {
        forecastHint = 'Forecast unavailable for this location — showing current conditions.';
      }
    }

    if (temp == null) {
      const { data } = await fetchCurrentWeather(apiKey, lat, lon, city);
      const cod = data.cod;
      const ok = cod === 200 || cod === '200';
      if (!ok) {
        const rawMsg = typeof data.message === 'string' ? data.message : 'Weather fetch failed';
        const msg =
          isCityNotFound(data) && city?.trim()
            ? 'No weather for this location. Use a city in the Ground field (e.g. London or Oxford), not only a venue name.'
            : rawMsg;
        return NextResponse.json({ error: msg, code: cod }, { status: 400 });
      }
      const t = data.main?.temp ?? null;
      if (t == null || !Number.isFinite(Number(t))) {
        return NextResponse.json({ error: 'Weather response missing temperature' }, { status: 502 });
      }
      temp = Number(t);
      main = data.weather?.[0]?.main ?? null;
      desc = data.weather?.[0]?.description ?? null;
      wind = data.wind?.speed != null && Number.isFinite(Number(data.wind.speed)) ? Number(data.wind.speed) : null;
    }

    const advisory = weatherAdvisoryFromConditions(temp, main) || null;
    const friendlyTip = weatherFriendlyTipFromConditions(temp, main, desc, wind);

    return NextResponse.json({
      temp,
      unit: 'C' as const,
      description: desc,
      main,
      wind,
      advisory,
      friendlyTip,
      forecastForMatch,
      forecastHint,
    });
  } catch {
    return NextResponse.json({ error: 'Weather fetch failed' }, { status: 502 });
  }
}

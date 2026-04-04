import { NextRequest, NextResponse } from 'next/server';
import { weatherAdvisoryFromConditions } from '@/lib/weather-advisory';

type OwPayload = {
  cod?: number | string;
  message?: string;
  main?: { temp?: number };
  weather?: Array<{ description?: string; main?: string }>;
};

function isCityNotFound(data: OwPayload): boolean {
  const cod = data.cod;
  if (cod === 404 || cod === '404') return true;
  const m = String(data.message ?? '').toLowerCase();
  return m.includes('not found');
}

function cityQueryAttempts(raw: string): string[] {
  const city = raw.trim();
  if (!city) return [];
  const attempts = [city];
  if (!city.includes(',')) attempts.push(`${city}, GB`);
  return Array.from(new Set(attempts));
}

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get('lat');
  const lon = req.nextUrl.searchParams.get('lon');
  const city = req.nextUrl.searchParams.get('city');
  const apiKey = process.env.OPENWEATHER_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Weather not configured', reason: 'missing_env' as const },
      { status: 503 },
    );
  }
  const base = `https://api.openweathermap.org/data/2.5/weather?appid=${apiKey}&units=imperial`;

  if (!lat && !lon && !city?.trim()) {
    return NextResponse.json({ error: 'Provide lat/lon or city' }, { status: 400 });
  }

  try {
    let data: OwPayload;

    if (lat && lon) {
      const url = `${base}&lat=${lat}&lon=${lon}`;
      const res = await fetch(url, { cache: 'no-store' });
      data = (await res.json()) as OwPayload;
    } else if (city?.trim()) {
      const attempts = cityQueryAttempts(city);
      data = { cod: 0, message: 'Weather fetch failed' };
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
    } else {
      return NextResponse.json({ error: 'Provide lat/lon or city' }, { status: 400 });
    }

    // OpenWeather returns cod as number 200 or string "200" on success.
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
    const temp = data.main?.temp ?? null;
    const desc = data.weather?.[0]?.description ?? null;
    const main = data.weather?.[0]?.main ?? null;
    if (temp == null || !Number.isFinite(Number(temp))) {
      return NextResponse.json({ error: 'Weather response missing temperature' }, { status: 502 });
    }
    const advisory = weatherAdvisoryFromConditions(temp, main) || null;
    return NextResponse.json({
      temp,
      description: desc,
      main,
      advisory,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Weather fetch failed' }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { weatherAdvisoryFromConditions } from '@/lib/weather-advisory';

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get('lat');
  const lon = req.nextUrl.searchParams.get('lon');
  const city = req.nextUrl.searchParams.get('city');
  if (!OPENWEATHER_API_KEY) {
    return NextResponse.json({ error: 'Weather not configured' }, { status: 503 });
  }
  let url = `https://api.openweathermap.org/data/2.5/weather?appid=${OPENWEATHER_API_KEY}&units=imperial`;
  if (lat && lon) {
    url += `&lat=${lat}&lon=${lon}`;
  } else if (city) {
    url += `&q=${encodeURIComponent(city)}`;
  } else {
    return NextResponse.json({ error: 'Provide lat/lon or city' }, { status: 400 });
  }
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.cod !== 200) {
      return NextResponse.json({ error: data.message || 'Weather fetch failed' }, { status: 400 });
    }
    const temp = data.main?.temp ?? null;
    const desc = data.weather?.[0]?.description ?? null;
    const main = data.weather?.[0]?.main ?? null;
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

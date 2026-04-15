/** Shared hot/cold/rain copy for API and client (cached weather rows). `temp` is °C. */

export function weatherAdvisoryFromConditions(
  temp: number | null | undefined,
  main: string | null | undefined,
): string {
  let advisory = '';
  if (temp != null && Number.isFinite(Number(temp))) {
    const t = Number(temp);
    if (t > 29) {
      advisory =
        "It's too hot — come prepared with sunscreen, a hat, and extra water. Hydrate often.";
    } else if (t < 10) {
      advisory = 'Cold conditions — wear layers and warm up properly.';
    }
  }
  if (main === 'Rain') {
    advisory = (advisory ? advisory + ' ' : '') + 'Rain expected — bring umbrellas and towels.';
  }
  return advisory.trim();
}

/** Always returns a short, human line when we cannot show a formal advisory (or alongside it). `windMps` optional from OpenWeather. */
export function weatherFriendlyTipFromConditions(
  temp: number | null | undefined,
  main: string | null | undefined,
  description: string | null | undefined,
  windMps: number | null | undefined,
): string {
  const m = (main ?? '').toLowerCase();
  const desc = (description ?? '').toLowerCase();
  const wind = windMps != null && Number.isFinite(Number(windMps)) ? Number(windMps) : null;

  if (wind != null && wind >= 10) {
    return 'Be ready — wind is very strong. Expect extra movement in the air and adjust lines and calls.';
  }
  if (wind != null && wind >= 7) {
    return 'Breezy to windy — stay balanced and watch the ball closely in the air.';
  }
  if (wind != null && wind >= 4.5) {
    return 'A bit breezy — conditions stay playable; keep your footing and track the ball.';
  }
  if (m === 'rain' || desc.includes('rain') || desc.includes('drizzle') || desc.includes('shower')) {
    return 'Wet ball possible — keep a towel handy and watch footing on the outfield.';
  }
  if (m === 'snow' || desc.includes('snow')) {
    return 'Wintry conditions — take care with footing and warm up thoroughly.';
  }
  if (m === 'thunderstorm' || desc.includes('thunder')) {
    return 'Storm risk — stay alert to official stoppages and shelter if lightning appears.';
  }
  if (desc.includes('overcast') || (m === 'clouds' && desc.includes('cloud'))) {
    return 'Overcast skies — the ball can swing a bit; stay focused and keep the ball dry.';
  }
  if (m === 'clouds' || desc.includes('cloud')) {
    return 'Cloudy conditions — usually playable; grip may feel a touch heavier.';
  }
  if (m === 'clear' || desc.includes('clear sky')) {
    if (temp != null && temp < 10) return 'Clear but cold — layers and a solid warm-up.';
    return 'Weather looks good — all the best for the match.';
  }
  if (m === 'mist' || m === 'fog' || desc.includes('mist') || desc.includes('fog')) {
    return 'Lower visibility — communicate clearly in the field and between overs.';
  }
  if (temp != null && temp > 29) {
    return 'Hot day — hydrate, seek shade between overs, and pace yourself.';
  }
  if (temp != null && temp < 10) {
    return 'Cold air — keep warm between overs and stay loose.';
  }
  return 'Conditions look playable — stay sharp and enjoy the game.';
}

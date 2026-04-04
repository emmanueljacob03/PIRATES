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

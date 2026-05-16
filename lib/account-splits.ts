/** Split total equally across N people; last person gets remainder so sum matches total (cents). */
export function equalShareAmounts(total: number, count: number): number[] {
  if (count < 1 || !Number.isFinite(total) || total <= 0) return [];
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / count);
  let remainder = totalCents - base * count;
  const shares: number[] = [];
  for (let i = 0; i < count; i++) {
    const cents = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    shares.push(cents / 100);
  }
  return shares;
}

export function formatUsd(amount: number): string {
  const cents = Math.round(amount * 100);
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

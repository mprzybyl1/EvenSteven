// Wszystko liczymy w GROSZACH (Int). Tu konwersje i formatowanie do wyświetlania.

export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("pl-PL", { style: "currency", currency }).format(minor / 100);
  } catch {
    // Nieznany kod waluty -> fallback bez symbolu.
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

// "12,34" albo "12.34" -> 1234 (grosze). Zwraca null jak się nie parsuje.
export function parseAmountToMinor(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  return Math.round(parseFloat(normalized) * 100);
}

// Podział równy z rozrzuceniem reszty: pierwsi dostają o grosz więcej.
// splitEqual(1000, 3) -> [334, 333, 333]
export function splitEqual(totalMinor: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(totalMinor / n);
  let remainder = totalMinor - base * n;
  return Array.from({ length: n }, () => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder--;
    return base + extra;
  });
}

// Podział wg procentów (sumują się ~100). Reszta groszowa idzie do największych udziałów.
export function splitByPercent(totalMinor: number, percents: number[]): number[] {
  const raw = percents.map((p) => (totalMinor * p) / 100);
  const floored = raw.map((r) => Math.floor(r));
  let remainder = totalMinor - floored.reduce((a, b) => a + b, 0);
  // indeksy wg największej części ułamkowej
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floored];
  for (const { i } of order) {
    if (remainder <= 0) break;
    result[i]++;
    remainder--;
  }
  return result;
}

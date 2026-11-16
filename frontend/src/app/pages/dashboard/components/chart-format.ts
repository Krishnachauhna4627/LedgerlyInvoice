// Short ₹ amounts for chart axes and labels, in Indian units: ₹950, ₹12k, ₹1.5L, ₹2Cr.
export function compactInr(n: number): string {
  const abs = Math.abs(n);
  const [div, unit] = abs >= 1e7 ? [1e7, 'Cr'] : abs >= 1e5 ? [1e5, 'L'] : abs >= 1e3 ? [1e3, 'k'] : [1, ''];
  const v = n / div;
  return `₹${Number.isInteger(v) ? v : v.toFixed(Math.abs(v) < 10 ? 1 : 0).replace(/\.0$/, '')}${unit}`;
}

// 'YYYY-MM' → 'Jun'.
export const monthLabel = (month: string): string =>
  new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleString('en-IN', { month: 'short' });

// A rounded axis top and step (1, 2, 2.5 or 5 × 10ⁿ) giving about `ticks` gridlines above zero.
export function niceScale(max: number, ticks = 4): { top: number; step: number } {
  if (max <= 0) return { top: ticks * 1000, step: 1000 };
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  return { top: step * Math.ceil(max / step), step };
}

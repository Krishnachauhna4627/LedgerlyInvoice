// Local-time date helpers; all API dates are 'YYYY-MM-DD' strings.
export const toIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const todayIso = (): string => toIsoDate(new Date());

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toIsoDate(new Date(y, m - 1, d + days));
}

// Indian financial year (1 April – 31 March) containing the given date.
export function financialYear(iso = todayIso()): { from: string; to: string } {
  const [y, m] = iso.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return { from: `${start}-04-01`, to: `${start + 1}-03-31` };
}

// 'YYYY-MM-DD' → 'DD-MM-YYYY', as printed on ledgers.
export const formatDmy = (iso: string | null): string => (iso ? iso.split('-').reverse().join('-') : '—');

export type Period = 'this_month' | 'last_3_months' | 'last_6_months' | 'this_year' | 'all';

export const PERIODS: { value: Period; label: string }[] = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'last_6_months', label: 'Last 6 months' },
  { value: 'this_year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

export function periodRange(period: Period): { from?: string; to?: string } {
  const now = new Date();
  const start = (monthsBack: number) => toIsoDate(new Date(now.getFullYear(), now.getMonth() - monthsBack, 1));
  switch (period) {
    case 'this_month':
      return { from: start(0) };
    case 'last_3_months':
      return { from: start(2) };
    case 'last_6_months':
      return { from: start(5) };
    case 'this_year':
      return { from: `${now.getFullYear()}-01-01` };
    default:
      return {};
  }
}

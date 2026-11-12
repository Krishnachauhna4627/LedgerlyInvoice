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

// ISO timestamp (e.g. an entry's createdAt) → local time like '9:49 AM'; '' when there is none.
export const formatTime = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';

// A date with the time it was saved: '21-10-2026, 9:49 AM' (just the date when there is no time).
export const formatDmyTime = (date: string | null, createdAt: string | null | undefined): string => {
  const time = formatTime(createdAt);
  return time ? `${formatDmy(date)}, ${time}` : formatDmy(date);
};

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

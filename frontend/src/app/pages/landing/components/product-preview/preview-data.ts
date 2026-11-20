import { IconName } from '../../../../shared/components/icon/icons';
import { DisplayStatus } from '../../../../core/data/models';

// Sample figures for the landing page dashboard mockup (mirrors pages/dashboard).
export type PreviewTone = 'indigo' | 'orange' | 'green';

export interface PreviewTile {
  label: string;
  value: string;
  note: string;
  change: string;
  up: boolean;
  icon: IconName;
  tone: PreviewTone;
  series: number[];
}

export const PREVIEW_NAV: { label: string; icon: IconName }[] = [
  { label: 'Dashboard', icon: 'layout' },
  { label: 'Sale Invoice', icon: 'file-text' },
  { label: 'Receipts', icon: 'rupee' },
  { label: 'Purchases', icon: 'receipt' },
  { label: 'Payments', icon: 'send' },
  { label: 'Ledgers', icon: 'users' },
  { label: 'Products/Services', icon: 'box' },
  { label: 'Reports', icon: 'bar-chart' },
  { label: 'Business Details', icon: 'settings' },
];

export const PREVIEW_TILES: PreviewTile[] = [
  {
    label: 'Sales this month', value: '₹2,48,500', note: '18 invoices', change: '+12.4%', up: true,
    icon: 'rupee', tone: 'indigo', series: [120, 160, 140, 190, 210, 248],
  },
  {
    label: 'Receivable', value: '₹86,200', note: '5 customers with dues', change: '-8.1%', up: false,
    icon: 'receipt', tone: 'orange', series: [110, 95, 120, 100, 94, 86],
  },
  {
    label: 'Received', value: '₹1,62,300', note: '14 receipts', change: '+9.6%', up: true,
    icon: 'check-circle', tone: 'green', series: [90, 120, 110, 140, 148, 162],
  },
];

// Sales vs purchases, in ₹ thousands.
export const PREVIEW_TREND = [
  { month: 'Jun', sales: 120, purchases: 80 },
  { month: 'Jul', sales: 160, purchases: 95 },
  { month: 'Aug', sales: 140, purchases: 110 },
  { month: 'Sep', sales: 190, purchases: 120 },
  { month: 'Oct', sales: 210, purchases: 130 },
  { month: 'Nov', sales: 248, purchases: 150 },
];
export const PREVIEW_TREND_TOP = 250;

export const PREVIEW_RECEIVABLE = { received: 162300, receivable: 86200 };

export const PREVIEW_INVOICES: { number: string; client: string; amount: string; status: DisplayStatus; date: string }[] = [
  { number: 'INV-042', client: 'ABC Traders', amount: '₹60,180', status: 'paid', date: '18 Nov' },
  { number: 'INV-041', client: 'Sharma Electronics', amount: '₹24,780', status: 'unpaid', date: '15 Nov' },
  { number: 'INV-040', client: 'Punjab Steel Co.', amount: '₹41,300', status: 'overdue', date: '02 Nov' },
];

// Sparkline paths in a 64×28 box, like the dashboard's stat tiles.
export function sparkPaths(values: number[]): { line: string; area: string } {
  const w = 64;
  const h = 28;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const line = values
    .map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 6)).toFixed(1)}`)
    .join(' ');
  return { line, area: `${line} L${w},${h} L0,${h} Z` };
}

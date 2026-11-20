import { Component, computed, inject, signal } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { CompanyService } from '../../core/data/company.service';
import { DashboardPeriod, DashboardSummary, DashboardTrendMonth } from '../../core/data/models';
import { ReportService } from '../../core/data/report.service';
import { Icon } from '../../shared/components/icon/icon';
import { IconName } from '../../shared/components/icon/icons';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { GetStarted, SetupStep } from './components/get-started/get-started';
import { RecentInvoices } from './components/recent-invoices/recent-invoices';
import { StatTile, TileTone } from './components/stat-tile/stat-tile';
import { DonutSlice, SummaryDonut } from './components/summary-donut/summary-donut';
import { TrendChart } from './components/trend-chart/trend-chart';

interface Tile {
  key: string;
  label: string;
  value: string;
  note?: string;
  icon: IconName;
  tone: TileTone;
  // Page the tile opens when clicked.
  link: string;
  query?: Params;
  series?: number[];
  current?: number;
  previous?: number;
}

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'this_year', label: 'This financial year' },
];

// Chart colours come from the theme.
const INDIGO = 'var(--color-chart-sales)';
const ORANGE = 'var(--color-chart-purchases)';
const GREEN = 'var(--color-chart-settled)';

const inr = new InrPipe();
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const PERIOD_WORD: Record<DashboardPeriod, string> = {
  this_month: 'this month',
  last_month: 'last month',
  this_quarter: 'this quarter',
  this_year: 'this year',
};

// First page after login: the period's numbers and charts, recent invoices and a setup checklist.
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, Icon, PageHeader, StatTile, TrendChart, SummaryDonut, RecentInvoices, GetStarted],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly reports = inject(ReportService);
  private readonly company = inject(CompanyService);
  private readonly user = inject(AuthService).user;

  protected readonly periods = PERIODS;
  protected readonly period = signal<DashboardPeriod>('this_month');

  protected readonly subtitle = computed(() => {
    const first = this.user()?.name.split(/\s+/)[0];
    return first ? `Welcome back, ${first}` : '';
  });

  protected readonly summary = signal<DashboardSummary | null>(null);
  private readonly sellerReady = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly tiles = computed<Tile[]>(() => {
    const s = this.summary();
    if (!s) return [];
    const word = PERIOD_WORD[s.period.key];
    const series = (key: keyof Omit<DashboardTrendMonth, 'month'>) => s.trend.map((m) => m[key]);
    const flow = (stat: DashboardSummary['sales']) => ({ current: stat.amount, previous: stat.previous });
    return [
      {
        key: 'sales', label: `Sales ${word}`, value: inr.transform(s.sales.amount), note: plural(s.sales.count, 'invoice'),
        icon: 'rupee', tone: 'indigo', link: '/invoices', query: s.period.key === 'this_month' ? { period: 'this_month' } : undefined,
        series: series('sales'), ...flow(s.sales),
      },
      {
        key: 'receivable', label: 'Receivable', value: inr.transform(s.receivable.amount), note: `${plural(s.receivable.count, 'customer')} with dues`,
        icon: 'receipt', tone: 'orange', link: '/clients', series: series('receivable'), ...flow(s.receivable),
      },
      {
        key: 'received', label: 'Received', value: inr.transform(s.received.amount), note: plural(s.received.count, 'receipt'),
        icon: 'clock', tone: 'indigo', link: '/receipts', series: series('received'), ...flow(s.received),
      },
      {
        key: 'purchases', label: `Purchase ${word}`, value: inr.transform(s.purchases.amount), note: plural(s.purchases.count, 'bill'),
        icon: 'shopping-bag', tone: 'orange', link: '/purchases', series: series('purchases'), ...flow(s.purchases),
      },
      {
        key: 'payable', label: 'Payable', value: inr.transform(s.payable.amount), note: `${plural(s.payable.count, 'vendor')} due`,
        icon: 'wallet', tone: 'orange', link: '/purchases', series: series('payable'), ...flow(s.payable),
      },
      {
        key: 'paid', label: 'Paid', value: inr.transform(s.paid.amount), note: plural(s.paid.count, 'payment'),
        icon: 'check-circle', tone: 'green', link: '/payments', series: series('paid'), ...flow(s.paid),
      },
      {
        key: 'people', label: 'Customers / vendors', value: String(s.clientCount + s.vendorCount),
        note: `${plural(s.clientCount, 'customer')} · ${plural(s.vendorCount, 'vendor')}`, icon: 'users', tone: 'indigo', link: '/clients',
      },
      // ​: lets the label wrap after the slash on narrow phone tiles.
      { key: 'items', label: 'Products/​Services', value: String(s.itemCount), icon: 'box', tone: 'indigo', link: '/items' },
    ];
  });

  protected readonly receivableSlices = computed<DonutSlice[]>(() => {
    const s = this.summary();
    return s
      ? [
          { label: 'Received', value: s.received.amount, color: GREEN },
          { label: 'Receivable', value: s.receivable.amount, color: INDIGO },
        ]
      : [];
  });

  protected readonly payableSlices = computed<DonutSlice[]>(() => {
    const s = this.summary();
    return s
      ? [
          { label: 'Paid', value: s.paid.amount, color: GREEN },
          { label: 'Unpaid', value: s.payable.amount, color: ORANGE },
        ]
      : [];
  });

  protected readonly steps = computed<SetupStep[]>(() => {
    const s = this.summary();
    if (!s) return [];
    return [
      { label: 'Add your seller details', hint: 'Business address, state and GSTIN.', link: '/settings', done: this.sellerReady(), icon: 'building' },
      { label: 'Add a party', hint: 'Save who you bill, with their GSTIN.', link: '/clients', done: s.clientCount > 0, icon: 'users' },
      { label: 'Add a product/service', hint: 'With HSN/SAC and GST rate.', link: '/items', done: s.itemCount > 0, icon: 'box' },
      { label: 'Create your first invoice', hint: 'Bill a customer in seconds.', link: '/invoices/new', done: s.recentInvoices.length > 0, icon: 'file-text' },
    ];
  });
  protected readonly setupDone = computed(() => this.steps().every((s) => s.done));

  constructor() {
    this.load();
  }

  protected changePeriod(period: DashboardPeriod): void {
    this.period.set(period);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ summary: this.reports.dashboard(this.period()), company: this.company.get() }).subscribe({
      next: ({ summary, company }) => {
        this.summary.set(summary);
        this.sellerReady.set(!!company.stateCode);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(toApiError(err).message);
        this.loading.set(false);
      },
    });
  }
}

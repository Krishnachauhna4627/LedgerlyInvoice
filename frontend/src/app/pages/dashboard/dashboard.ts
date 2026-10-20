import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { CompanyService } from '../../core/data/company.service';
import { DashboardSummary } from '../../core/data/models';
import { ReportService } from '../../core/data/report.service';
import { Icon } from '../../shared/components/icon/icon';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { GetStarted, SetupStep } from './components/get-started/get-started';
import { RecentInvoices } from './components/recent-invoices/recent-invoices';
import { StatTiles } from './components/stat-tiles/stat-tiles';

// First page after login: this month's numbers, recent invoices and a setup checklist.
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, Icon, PageHeader, StatTiles, RecentInvoices, GetStarted],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly reports = inject(ReportService);
  private readonly company = inject(CompanyService);
  private readonly user = inject(AuthService).user;

  protected readonly subtitle = computed(() => {
    const first = this.user()?.name.split(/\s+/)[0];
    return first ? `Welcome back, ${first}` : '';
  });

  protected readonly summary = signal<DashboardSummary | null>(null);
  private readonly sellerReady = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly steps = computed<SetupStep[]>(() => {
    const s = this.summary();
    if (!s) return [];
    return [
      { label: 'Add your seller details', hint: 'Business address, state and GSTIN.', link: '/settings', done: this.sellerReady(), icon: 'building' },
      { label: 'Add a client', hint: 'Save who you bill, with their GSTIN.', link: '/clients', done: s.clientCount > 0, icon: 'users' },
      { label: 'Add an item', hint: 'Products or services with HSN/SAC and GST rate.', link: '/items', done: s.itemCount > 0, icon: 'box' },
      { label: 'Create your first invoice', hint: 'Bill a client in seconds.', link: '/invoices/new', done: s.recentInvoices.length > 0, icon: 'file-text' },
    ];
  });
  protected readonly setupDone = computed(() => this.steps().every((s) => s.done));

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ summary: this.reports.dashboard(), company: this.company.get() }).subscribe({
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

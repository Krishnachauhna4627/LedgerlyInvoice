import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { AppTopbar } from '../../layout/app-topbar/app-topbar';
import { Icon } from '../../shared/components/icon/icon';
import { QuickActions } from './components/quick-actions/quick-actions';
import { RecentInvoices } from './components/recent-invoices/recent-invoices';
import { StatCards } from './components/stat-cards/stat-cards';

// First page after login. Reached only through authGuard, so the user is loaded.
@Component({
  selector: 'app-dashboard',
  imports: [AppTopbar, Icon, StatCards, RecentInvoices, QuickActions],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly user = inject(AuthService).user;

  protected readonly firstName = computed(() => this.user()?.name.split(/\s+/)[0] ?? '');
  protected readonly companyName = computed(() => this.user()?.company.name ?? '');
}

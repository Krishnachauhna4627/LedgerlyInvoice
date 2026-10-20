import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { InvoiceService } from '../../core/invoices/invoice.service';
import { Icon } from '../../shared/components/icon/icon';
import { IconName } from '../../shared/components/icon/icons';
import { LogoMark } from '../../shared/components/logo-mark/logo-mark';
import { ToastHost } from '../../shared/components/toast-host/toast-host';

interface NavItem {
  label: string;
  path: string;
  icon: IconName;
}

// Layout for every logged-in page: sidebar navigation + the page in <router-outlet>.
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, LogoMark, ToastHost],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly invoices = inject(InvoiceService);
  protected readonly invoiceCount = this.invoices.count;

  protected readonly nav: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: 'layout' },
    { label: 'Invoices', path: '/invoices', icon: 'file-text' },
    { label: 'Clients', path: '/clients', icon: 'users' },
    { label: 'Items', path: '/items', icon: 'box' },
    { label: 'Reports', path: '/reports', icon: 'bar-chart' },
    { label: 'Settings', path: '/settings', icon: 'settings' },
  ];

  protected readonly user = this.auth.user;
  protected readonly initials = computed(() =>
    (this.user()?.name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join(''),
  );
  protected readonly menuOpen = signal(false);

  constructor() {
    this.invoices.refreshCount();
    // Close the mobile drawer after navigating.
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.menuOpen.set(false));
  }

  protected logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}

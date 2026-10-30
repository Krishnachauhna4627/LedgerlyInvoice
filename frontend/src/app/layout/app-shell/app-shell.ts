import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { InvoiceService } from '../../core/invoices/invoice.service';
import { Icon } from '../../shared/components/icon/icon';
import { IconName } from '../../shared/components/icon/icons';
import { LogoMark } from '../../shared/components/logo-mark/logo-mark';
import { Modal } from '../../shared/components/modal/modal';
import { PasswordForm } from '../../shared/components/password-form/password-form';
import { ProfileForm } from '../../shared/components/profile-form/profile-form';
import { ToastHost } from '../../shared/components/toast-host/toast-host';

interface NavItem {
  label: string;
  path: string;
  icon: IconName;
}

// Layout for every logged-in page: sidebar navigation + the page in <router-outlet>.
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, LogoMark, Modal, PasswordForm, ProfileForm, ToastHost],
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
    { label: 'Customers', path: '/clients', icon: 'users' },
    { label: 'Products/Services', path: '/items', icon: 'box' },
    { label: 'Reports', path: '/reports', icon: 'bar-chart' },
    { label: 'Business Details', path: '/settings', icon: 'settings' },
  ];
  // Only shown to the super user.
  protected readonly adminNav: NavItem[] = [{ label: 'Users', path: '/admin/users', icon: 'shield' }];

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
  // Which account dialog is open, if any.
  protected readonly profileView = signal<'profile' | 'password' | null>(null);

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

import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { AdminService } from '../../core/data/admin.service';
import { AdminUser } from '../../core/data/models';
import { Icon } from '../../shared/components/icon/icon';
import { Modal } from '../../shared/components/modal/modal';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';

// /admin/users — every account and its company, for the super user.
@Component({
  selector: 'app-admin-users-page',
  imports: [RouterLink, DatePipe, Icon, Modal, PageHeader, InrPipe],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.scss',
})
export class AdminUsers {
  private readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);
  protected readonly me = this.auth.user;

  protected readonly users = signal<AdminUser[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly search = signal('');
  // "Log in as" confirmation: the user it is for.
  protected readonly confirming = signal<AdminUser | null>(null);
  protected readonly loginAsBusy = signal(false);
  protected readonly loginAsError = signal<string | null>(null);

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.users();
    return this.users().filter((u) =>
      [u.name, u.username, u.email ?? '', u.phone, u.company.name].some((v) => v.toLowerCase().includes(term)),
    );
  });

  constructor() {
    this.load();
  }

  protected cancelLoginAs(): void {
    if (this.loginAsBusy()) return;
    this.confirming.set(null);
    this.loginAsError.set(null);
  }

  // Switches to the user's session, then reloads the app so nothing of the admin's data stays in memory.
  protected loginAs(user: AdminUser): void {
    if (this.loginAsBusy()) return;
    this.loginAsBusy.set(true);
    this.loginAsError.set(null);
    this.auth.loginAs(user.id).subscribe({
      next: () => window.location.assign('/dashboard'),
      error: (err: unknown) => {
        this.loginAsError.set(toApiError(err).message);
        this.loginAsBusy.set(false);
      },
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.admin.listUsers().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toApiError(err).message);
        this.loading.set(false);
      },
    });
  }
}

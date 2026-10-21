import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { AdminService } from '../../core/data/admin.service';
import { AdminUserDetail as Detail } from '../../core/data/models';
import { stateLabel } from '../../core/gst/gst-states';
import { Icon } from '../../shared/components/icon/icon';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { InrPipe } from '../../shared/pipes/inr.pipe';

// /admin/users/:id — one user's profile, company, invoices, clients and items (read-only).
@Component({
  selector: 'app-admin-user-detail-page',
  imports: [RouterLink, DatePipe, Icon, PageHeader, StatusBadge, InrPipe],
  templateUrl: './admin-user-detail.html',
  styleUrl: './admin-user-detail.scss',
})
export class AdminUserDetail {
  private readonly admin = inject(AdminService);
  private readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  protected readonly detail = signal<Detail | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly stateLabel = stateLabel;

  constructor() {
    this.admin.getUser(this.id).subscribe({
      next: (detail) => this.detail.set(detail),
      error: (err: unknown) => this.loadError.set(toApiError(err).message),
    });
  }
}

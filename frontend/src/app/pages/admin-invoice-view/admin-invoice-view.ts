import { Location } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { AdminService } from '../../core/data/admin.service';
import { Invoice } from '../../core/data/models';
import { Icon } from '../../shared/components/icon/icon';
import { InvoiceDocument } from '../../shared/components/invoice-document/invoice-document';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { InrPipe } from '../../shared/pipes/inr.pipe';

// /admin/invoices/:id — any company's invoice, read-only (print only).
@Component({
  selector: 'app-admin-invoice-view-page',
  imports: [RouterLink, Icon, InvoiceDocument, PageHeader, StatusBadge, InrPipe],
  templateUrl: './admin-invoice-view.html',
  styleUrl: '../invoice-view/invoice-view.scss',
})
export class AdminInvoiceView {
  private readonly admin = inject(AdminService);
  private readonly location = inject(Location);
  private readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  protected readonly invoice = signal<Invoice | null>(null);
  protected readonly loadError = signal<string | null>(null);

  constructor() {
    this.admin.getInvoice(this.id).subscribe({
      next: (invoice) => this.invoice.set(invoice),
      error: (err: unknown) => this.loadError.set(toApiError(err).message),
    });
  }

  protected back(): void {
    this.location.back();
  }

  protected print(): void {
    window.print();
  }
}

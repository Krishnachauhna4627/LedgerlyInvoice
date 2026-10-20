import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { Invoice, InvoiceStatus } from '../../core/data/models';
import { InvoiceService } from '../../core/invoices/invoice.service';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon/icon';
import { InvoiceDocument } from '../../shared/components/invoice-document/invoice-document';
import { Modal } from '../../shared/components/modal/modal';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { InrPipe } from '../../shared/pipes/inr.pipe';

// /invoices/:id — the printable invoice plus actions (edit, duplicate, paid/unpaid, print, delete).
@Component({
  selector: 'app-invoice-view-page',
  imports: [RouterLink, Icon, InvoiceDocument, Modal, PageHeader, StatusBadge, InrPipe],
  templateUrl: './invoice-view.html',
  styleUrl: './invoice-view.scss',
})
export class InvoiceView {
  private readonly invoices = inject(InvoiceService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  protected readonly invoice = signal<Invoice | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly confirmDelete = signal(false);

  constructor() {
    this.invoices.get(this.id).subscribe({
      next: (invoice) => this.invoice.set(invoice),
      error: (err: unknown) => this.loadError.set(toApiError(err).message),
    });
  }

  protected setStatus(status: InvoiceStatus): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.invoices.setStatus(this.id, status).subscribe({
      next: (invoice) => {
        this.invoice.set(invoice);
        this.busy.set(false);
        this.toast.success(status === 'paid' ? 'Marked as paid.' : 'Marked as unpaid.');
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.toast.error(toApiError(err).message);
      },
    });
  }

  protected print(): void {
    window.print();
  }

  protected delete(): void {
    if (this.busy()) return;
    this.busy.set(true);
    const number = this.invoice()?.invoiceNumber;
    this.invoices.delete(this.id).subscribe({
      next: () => {
        this.toast.success(`Invoice ${number} deleted.`);
        this.router.navigateByUrl('/invoices');
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.confirmDelete.set(false);
        this.toast.error(toApiError(err).message);
      },
    });
  }
}

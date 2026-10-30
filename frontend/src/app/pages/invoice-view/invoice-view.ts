import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { Invoice } from '../../core/data/models';
import { InvoiceService } from '../../core/invoices/invoice.service';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon/icon';
import { InvoiceDocument } from '../../shared/components/invoice-document/invoice-document';
import { Modal } from '../../shared/components/modal/modal';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ReceiptForm } from '../../shared/components/receipt-form/receipt-form';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { InrPipe } from '../../shared/pipes/inr.pipe';

// /invoices/:id — the printable invoice plus actions (edit, duplicate, record receipt, ledger, print, delete).
@Component({
  selector: 'app-invoice-view-page',
  imports: [RouterLink, Icon, InvoiceDocument, Modal, PageHeader, StatusBadge, InrPipe, ReceiptForm],
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
  protected readonly receiptOpen = signal(false);

  constructor() {
    this.load();
  }

  private load(): void {
    this.invoices.get(this.id).subscribe({
      next: (invoice) => this.invoice.set(invoice),
      error: (err: unknown) => this.loadError.set(toApiError(err).message),
    });
  }

  // Receipts settle the customer's oldest invoices first; reload to show this one's new status.
  protected onReceiptSaved(): void {
    this.receiptOpen.set(false);
    this.load();
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

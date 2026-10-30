import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { ClientService } from '../../core/data/client.service';
import { Client, Receipt, ReceiptMode } from '../../core/data/models';
import { ReceiptService } from '../../core/data/receipt.service';
import { downloadCsv } from '../../core/ui/csv';
import { financialYear, formatDmy } from '../../core/ui/dates';
import { paged } from '../../core/ui/paged';
import { ToastService } from '../../core/ui/toast.service';
import { round2 } from '../../core/gst/gst';
import { Icon } from '../../shared/components/icon/icon';
import { Modal } from '../../shared/components/modal/modal';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ReceiptForm } from '../../shared/components/receipt-form/receipt-form';
import { ShowMore } from '../../shared/components/show-more/show-more';
import { InrPipe } from '../../shared/pipes/inr.pipe';

export const MODE_LABEL: Record<ReceiptMode, string> = { cash: 'Cash', bank: 'Bank' };

// /payments — every receipt from customers, with filters and cash / bank totals.
@Component({
  selector: 'app-payments-page',
  imports: [PageHeader, Icon, Modal, ReceiptForm, InrPipe, RouterLink, ShowMore],
  templateUrl: './payments.html',
  styleUrl: './payments.scss',
})
export class Payments {
  private readonly receiptService = inject(ReceiptService);
  private readonly toast = inject(ToastService);

  protected readonly receipts = signal<Receipt[]>([]);
  protected readonly page = paged(this.receipts);
  protected readonly clients = signal<Client[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  // Filters; the period starts as the current financial year.
  protected readonly from = signal(financialYear().from);
  protected readonly to = signal(financialYear().to);
  protected readonly clientId = signal<number | null>(null);
  protected readonly mode = signal<ReceiptMode | ''>('');
  protected readonly rangeInvalid = computed(() => !!this.from() && !!this.to() && this.from() > this.to());

  // Record / edit modal: `editing` = the receipt, or null for a new one.
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Receipt | null>(null);
  protected readonly deleting = signal<Receipt | null>(null);
  protected readonly deleteBusy = signal(false);

  protected readonly modeLabel = MODE_LABEL;
  protected readonly formatDmy = formatDmy;
  protected readonly totals = computed(() => {
    const sum = (list: Receipt[]) => round2(list.reduce((total, r) => total + r.amount, 0));
    const list = this.receipts();
    return {
      all: sum(list),
      cash: sum(list.filter((r) => r.mode === 'cash')),
      bank: sum(list.filter((r) => r.mode === 'bank')),
    };
  });

  constructor() {
    inject(ClientService)
      .list()
      .subscribe({ next: (clients) => this.clients.set(clients) });
    this.load();
  }

  protected load(): void {
    if (this.rangeInvalid()) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.receiptService
      .list({
        from: this.from() || undefined,
        to: this.to() || undefined,
        clientId: this.clientId() ?? undefined,
        mode: this.mode() || undefined,
      })
      .subscribe({
        next: (receipts) => {
          this.receipts.set(receipts);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loadError.set(toApiError(err).message);
          this.loading.set(false);
        },
      });
  }

  protected setFilter(name: 'from' | 'to' | 'clientId' | 'mode', value: string): void {
    if (name === 'clientId') this.clientId.set(value ? Number(value) : null);
    else if (name === 'mode') this.mode.set(value as ReceiptMode | '');
    else this[name].set(value);
    this.page.reset();
    this.load();
  }

  protected openForm(receipt: Receipt | null): void {
    this.editing.set(receipt);
    this.formOpen.set(true);
  }

  protected onSaved(): void {
    this.formOpen.set(false);
    this.load();
  }

  protected confirmDelete(): void {
    const receipt = this.deleting();
    if (!receipt || this.deleteBusy()) return;
    this.deleteBusy.set(true);
    this.receiptService.delete(receipt.id).subscribe({
      next: () => {
        this.receipts.update((list) => list.filter((r) => r.id !== receipt.id));
        this.toast.success('Receipt deleted');
        this.deleting.set(null);
        this.deleteBusy.set(false);
      },
      error: (err: unknown) => {
        this.toast.error(toApiError(err).message);
        this.deleteBusy.set(false);
      },
    });
  }

  protected exportCsv(): void {
    downloadCsv(
      `receipts${this.from() ? '-' + this.from() : ''}${this.to() ? '-to-' + this.to() : ''}.csv`,
      ['Date', 'Customer', 'Mode', 'Narration', 'Amount'],
      this.receipts().map((r) => [formatDmy(r.receiptDate), r.clientName, MODE_LABEL[r.mode], r.reference, r.amount]),
    );
  }
}

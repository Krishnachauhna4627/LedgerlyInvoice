import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { PurchasePayment, ReceiptMode } from '../../core/data/models';
import { PurchasePaymentService } from '../../core/data/purchase-payment.service';
import { round2 } from '../../core/gst/gst';
import { bankAccountLabel } from '../../core/receipts/receipt-labels';
import { downloadCsv } from '../../core/ui/csv';
import { financialYear, formatDmy } from '../../core/ui/dates';
import { paged } from '../../core/ui/paged';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon/icon';
import { Modal } from '../../shared/components/modal/modal';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ShowMore } from '../../shared/components/show-more/show-more';
import { InrPipe } from '../../shared/pipes/inr.pipe';

const MODE_LABEL: Record<ReceiptMode, string> = { cash: 'Cash', bank: 'Bank' };

// /payments — money paid to vendors for purchases, with filters and cash / bank totals.
@Component({
  selector: 'app-purchase-payments-page',
  imports: [PageHeader, Icon, Modal, InrPipe, RouterLink, ShowMore],
  templateUrl: './purchase-payments.html',
  styleUrl: './purchase-payments.scss',
})
export class PurchasePayments {
  private readonly service = inject(PurchasePaymentService);
  private readonly toast = inject(ToastService);

  protected readonly payments = signal<PurchasePayment[]>([]);
  protected readonly page = paged(this.payments);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  // Filters; the period starts as the current financial year.
  protected readonly from = signal(financialYear().from);
  protected readonly to = signal(financialYear().to);
  protected readonly mode = signal<ReceiptMode | ''>('');
  protected readonly rangeInvalid = computed(() => !!this.from() && !!this.to() && this.from() > this.to());

  protected readonly deleting = signal<PurchasePayment | null>(null);
  protected readonly deleteBusy = signal(false);

  protected readonly formatDmy = formatDmy;
  protected readonly totals = computed(() => {
    const sum = (list: PurchasePayment[]) => round2(list.reduce((total, p) => total + p.totals.grandTotal, 0));
    const list = this.payments();
    return {
      all: sum(list),
      cash: sum(list.filter((p) => p.mode === 'cash')),
      bank: sum(list.filter((p) => p.mode === 'bank')),
    };
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    if (this.rangeInvalid()) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.service.list({ from: this.from() || undefined, to: this.to() || undefined, mode: this.mode() || undefined }).subscribe({
      next: (payments) => {
        this.payments.set(payments);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toApiError(err).message);
        this.loading.set(false);
      },
    });
  }

  protected setFilter(name: 'from' | 'to' | 'mode', value: string): void {
    if (name === 'mode') this.mode.set(value as ReceiptMode | '');
    else this[name].set(value);
    this.page.reset();
    this.load();
  }

  // "Cash", "Bank" or "Bank · SBI 1234567890".
  protected modeText(p: PurchasePayment): string {
    const account = p.mode === 'bank' ? bankAccountLabel(p.bankAccount) : null;
    return account ? `${MODE_LABEL[p.mode]} · ${account}` : MODE_LABEL[p.mode];
  }

  // "Cement", or "Cement + 2 more".
  protected itemsText(p: PurchasePayment): string {
    const [first, ...rest] = p.lines;
    if (!first) return '—';
    return rest.length ? `${first.description} + ${rest.length} more` : first.description;
  }

  protected confirmDelete(): void {
    const payment = this.deleting();
    if (!payment || this.deleteBusy()) return;
    this.deleteBusy.set(true);
    this.service.delete(payment.id).subscribe({
      next: () => {
        this.payments.update((list) => list.filter((p) => p.id !== payment.id));
        this.toast.success('Payment deleted');
        this.deleting.set(null);
        this.deleteBusy.set(false);
      },
      error: (err: unknown) => {
        this.toast.error(toApiError(err).message);
        this.deleteBusy.set(false);
      },
    });
  }

  // One row per item, so the CSV shows everything bought.
  protected exportCsv(): void {
    downloadCsv(
      `payments${this.from() ? '-' + this.from() : ''}${this.to() ? '-to-' + this.to() : ''}.csv`,
      ['Payment No.', 'Date', 'Vendor', 'Item', 'Qty', 'Unit', 'Rate', 'GST %', 'Taxable', 'GST', 'Line total', 'Payment total', 'Mode', 'Note'],
      this.payments().flatMap((p) =>
        p.lines.map((l, i) => [
          p.paymentNumber,
          formatDmy(p.purchaseDate),
          p.vendorName,
          l.description,
          l.quantity,
          l.unit,
          l.unitPrice,
          l.gstRate,
          l.taxableAmount,
          l.totalTax,
          l.lineTotal,
          i === 0 ? p.totals.grandTotal : '',
          this.modeText(p),
          i === 0 ? p.note : '',
        ]),
      ),
    );
  }
}

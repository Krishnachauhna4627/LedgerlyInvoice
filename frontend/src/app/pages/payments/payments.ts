import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { ReceiptMode, VendorPayment } from '../../core/data/models';
import { VendorPaymentService } from '../../core/data/vendor-payment.service';
import { round2 } from '../../core/gst/gst';
import { bankAccountLabel } from '../../core/receipts/receipt-labels';
import { downloadCsv } from '../../core/ui/csv';
import { financialYear, formatDmy, formatTime } from '../../core/ui/dates';
import { paged } from '../../core/ui/paged';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon/icon';
import { Modal } from '../../shared/components/modal/modal';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ShowMore } from '../../shared/components/show-more/show-more';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { TimePipe } from '../../shared/pipes/time.pipe';
import { PaymentForm } from './components/payment-form/payment-form';

const MODE_LABEL: Record<ReceiptMode, string> = { cash: 'Cash', bank: 'Bank' };

// /payments — money paid to vendors (payment details only), with filters and cash / bank totals.
// The goods bought are recorded on /purchases, like receipts and invoices.
@Component({
  selector: 'app-payments-page',
  imports: [PageHeader, Icon, Modal, PaymentForm, InrPipe, TimePipe, RouterLink, ShowMore],
  templateUrl: './payments.html',
  styleUrl: './payments.scss',
})
export class Payments {
  private readonly service = inject(VendorPaymentService);
  private readonly toast = inject(ToastService);

  protected readonly payments = signal<VendorPayment[]>([]);
  protected readonly page = paged(this.payments);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  // Filters; the period starts as the current financial year.
  protected readonly from = signal(financialYear().from);
  protected readonly to = signal(financialYear().to);
  protected readonly mode = signal<ReceiptMode | ''>('');
  protected readonly rangeInvalid = computed(() => !!this.from() && !!this.to() && this.from() > this.to());

  // Record / edit modal: `editing` = the payment, or null for a new one.
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<VendorPayment | null>(null);
  protected readonly deleting = signal<VendorPayment | null>(null);
  protected readonly deleteBusy = signal(false);

  protected readonly formatDmy = formatDmy;
  protected readonly totals = computed(() => {
    const sum = (list: VendorPayment[]) => round2(list.reduce((total, p) => total + p.amount, 0));
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

  protected openForm(payment: VendorPayment | null): void {
    this.editing.set(payment);
    this.formOpen.set(true);
  }

  protected onSaved(): void {
    this.formOpen.set(false);
    this.load();
  }

  // "Cash", "Bank" or "Bank · SBI 1234567890".
  protected modeText(p: VendorPayment): string {
    const account = p.mode === 'bank' ? bankAccountLabel(p.bankAccount) : null;
    return account ? `${MODE_LABEL[p.mode]} · ${account}` : MODE_LABEL[p.mode];
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

  protected exportCsv(): void {
    downloadCsv(
      `payments${this.from() ? '-' + this.from() : ''}${this.to() ? '-to-' + this.to() : ''}.csv`,
      ['Payment No.', 'Date', 'Time', 'Vendor', 'Mode', 'Narration', 'Amount'],
      this.payments().map((p) => [p.paymentNumber, formatDmy(p.paymentDate), formatTime(p.createdAt), p.vendorName, this.modeText(p), p.reference, p.amount]),
    );
  }
}

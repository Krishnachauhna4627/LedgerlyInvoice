import { Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { CompanyService } from '../../core/data/company.service';
import { Company, ReceiptMode, VendorPayment } from '../../core/data/models';
import { VendorPaymentService } from '../../core/data/vendor-payment.service';
import { round2 } from '../../core/gst/gst';
import { createPaymentPdf } from '../../core/payments/payment-pdf';
import { openPdfInNewTab } from '../../core/pdf/open-pdf';
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
import { PaymentView } from './components/payment-view/payment-view';

const MODE_LABEL: Record<ReceiptMode, string> = { cash: 'Cash', bank: 'Bank' };

// /payments — money paid to vendors (payment details only), with filters and cash / bank totals.
// The goods bought are recorded on /purchases, like receipts and invoices.
@Component({
  selector: 'app-payments-page',
  imports: [PageHeader, Icon, Modal, PaymentForm, PaymentView, InrPipe, TimePipe, RouterLink, ShowMore],
  templateUrl: './payments.html',
  styleUrl: './payments.scss',
})
export class Payments {
  private readonly service = inject(VendorPaymentService);
  private readonly toast = inject(ToastService);
  // ?open=<payment id>&client=<id>&date=<YYYY-MM-DD> (from a party ledger): show that payment (read-only) straight away.
  private readonly urlParams = inject(ActivatedRoute).snapshot.queryParamMap;
  private openId: number | null = Number(this.urlParams.get('open')) || null;
  // Party whose ledger we came from (?open + ?client), for the "Back to ledger" buttons; null otherwise.
  protected readonly ledgerClientId = this.openId ? Number(this.urlParams.get('client')) || null : null;
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  // Whether there is an in-app page to go back to (false when this URL was opened directly).
  private readonly hasPrevious = !!this.router.currentNavigation()?.previousNavigation;

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
  // Business details printed on the voucher, and the payment whose PDF is being made.
  protected readonly company = signal<Company | null>(null);
  protected readonly printingId = signal<number | null>(null);
  protected readonly deleteBusy = signal(false);
  // Payment shown read-only in the view modal (opened from a party ledger).
  protected readonly viewing = signal<VendorPayment | null>(null);

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
    inject(CompanyService)
      .get()
      .subscribe({ next: (company) => this.company.set(company) });
    // Opening one payment: list the financial year it falls in, so it is in the list.
    const date = this.urlParams.get('date');
    if (this.openId && date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      this.from.set(financialYear(date).from);
      this.to.set(financialYear(date).to);
    }
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
        this.openFromUrl(payments);
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

  // Once, after the first load: show the payment asked for in the URL.
  private openFromUrl(payments: VendorPayment[]): void {
    if (this.openId === null) return;
    const payment = payments.find((p) => p.id === this.openId);
    this.openId = null;
    if (payment) this.viewing.set(payment);
    else this.toast.error('That payment was not found.');
  }

  // Back to the ledger exactly as it was (period, scroll); straight to it when the link was opened directly.
  protected backToLedger(): void {
    if (this.hasPrevious) this.location.back();
    else this.router.navigate(['/clients', this.ledgerClientId]);
  }

  // View modal → Edit: swap to the edit form for the same payment.
  protected editViewed(): void {
    const payment = this.viewing();
    this.viewing.set(null);
    if (payment) this.openForm(payment);
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

  // Opens the payment voucher as a PDF in a new tab with the print dialog (falls back to a download if the tab is blocked).
  protected async print(payment: VendorPayment): Promise<void> {
    if (this.printingId() !== null) return;
    this.printingId.set(payment.id);
    try {
      await openPdfInNewTab(() => createPaymentPdf(payment, this.company()), `Payment-${payment.paymentNumber}`);
    } catch {
      this.toast.error("Couldn't make the payment voucher PDF. Please try again.");
    } finally {
      this.printingId.set(null);
    }
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

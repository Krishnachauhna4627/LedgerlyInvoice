import { Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { ClientService } from '../../core/data/client.service';
import { CompanyService } from '../../core/data/company.service';
import { Client, Company, Receipt, ReceiptMode } from '../../core/data/models';
import { openPdfInNewTab } from '../../core/pdf/open-pdf';
import { createReceiptPdf } from '../../core/receipts/receipt-pdf';
import { bankAccountLabel } from '../../core/receipts/receipt-labels';
import { ReceiptService } from '../../core/data/receipt.service';
import { downloadCsv } from '../../core/ui/csv';
import { financialYear, formatDmy, formatTime } from '../../core/ui/dates';
import { paged } from '../../core/ui/paged';
import { ToastService } from '../../core/ui/toast.service';
import { round2 } from '../../core/gst/gst';
import { Icon } from '../../shared/components/icon/icon';
import { Modal } from '../../shared/components/modal/modal';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ReceiptForm } from '../../shared/components/receipt-form/receipt-form';
import { ShowMore } from '../../shared/components/show-more/show-more';
import { ReceiptView } from './components/receipt-view/receipt-view';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { TimePipe } from '../../shared/pipes/time.pipe';

export const MODE_LABEL: Record<ReceiptMode, string> = { cash: 'Cash', bank: 'Bank' };

// /receipts — every receipt from customers, with filters and cash / bank totals.
@Component({
  selector: 'app-receipts-page',
  imports: [PageHeader, Icon, Modal, ReceiptForm, ReceiptView, InrPipe, TimePipe, RouterLink, ShowMore],
  templateUrl: './receipts.html',
  styleUrl: './receipts.scss',
})
export class Receipts {
  private readonly receiptService = inject(ReceiptService);
  private readonly toast = inject(ToastService);
  // ?open=<receipt id>&client=<id>&date=<YYYY-MM-DD> (from a customer ledger): show that receipt (read-only) straight away.
  private readonly urlParams = inject(ActivatedRoute).snapshot.queryParamMap;
  private openId: number | null = Number(this.urlParams.get('open')) || null;
  // Customer whose ledger we came from (?open + ?client), for the "Back to ledger" buttons; null otherwise.
  protected readonly ledgerClientId = this.openId ? Number(this.urlParams.get('client')) || null : null;
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  // Whether there is an in-app page to go back to (false when this URL was opened directly).
  private readonly hasPrevious = !!this.router.currentNavigation()?.previousNavigation;

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
  // Receipt whose printable PDF is being made.
  protected readonly printingId = signal<number | null>(null);
  // Receipt shown read-only in the view modal (opened from a customer ledger).
  protected readonly viewing = signal<Receipt | null>(null);
  protected readonly company = signal<Company | null>(null);

  protected readonly modeLabel = MODE_LABEL;

  // "Cash", "Bank" or "Bank · SBI 1234567890".
  protected modeText(r: Receipt): string {
    const account = r.mode === 'bank' ? bankAccountLabel(r.bankAccount) : null;
    return account ? `${MODE_LABEL[r.mode]} · ${account}` : MODE_LABEL[r.mode];
  }
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
    inject(CompanyService)
      .get()
      .subscribe({ next: (company) => this.company.set(company) });
    // Opening one receipt: list that customer's receipts for the financial year it falls in, so it is in the list.
    const client = Number(this.urlParams.get('client'));
    const date = this.urlParams.get('date');
    if (this.openId && client) this.clientId.set(client);
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
          this.openFromUrl(receipts);
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

  // Once, after the first load: show the receipt asked for in the URL.
  private openFromUrl(receipts: Receipt[]): void {
    if (this.openId === null) return;
    const receipt = receipts.find((r) => r.id === this.openId);
    this.openId = null;
    if (receipt) this.viewing.set(receipt);
    else this.toast.error('That receipt was not found.');
  }

  // Back to the ledger exactly as it was (period, scroll); straight to it when the link was opened directly.
  protected backToLedger(): void {
    if (this.hasPrevious) this.location.back();
    else this.router.navigate(['/clients', this.ledgerClientId]);
  }

  // View modal → Edit: swap to the edit form for the same receipt.
  protected editViewed(): void {
    const receipt = this.viewing();
    this.viewing.set(null);
    if (receipt) this.openForm(receipt);
  }

  protected openForm(receipt: Receipt | null): void {
    this.editing.set(receipt);
    this.formOpen.set(true);
  }

  protected onSaved(): void {
    this.formOpen.set(false);
    this.load();
  }

  // Opens the receipt as a PDF in a new tab with the print dialog (falls back to a download if the tab is blocked).
  protected async print(receipt: Receipt): Promise<void> {
    if (this.printingId() !== null) return;
    this.printingId.set(receipt.id);
    try {
      await openPdfInNewTab(() => createReceiptPdf(receipt, this.company()), `Receipt-${receipt.receiptNumber ?? receipt.id}`);
    } catch {
      this.toast.error("Couldn't make the receipt PDF. Please try again.");
    } finally {
      this.printingId.set(null);
    }
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
      ['Receipt No.', 'Date', 'Time', 'Party', 'Mode', 'Narration', 'Amount'],
      this.receipts().map((r) => [r.receiptNumber, formatDmy(r.receiptDate), formatTime(r.createdAt), r.clientName, this.modeText(r), r.reference, r.amount]),
    );
  }
}

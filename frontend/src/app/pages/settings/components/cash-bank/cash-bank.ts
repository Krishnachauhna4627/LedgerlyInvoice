import { Component, computed, inject, output, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toApiError } from '../../../../core/api/api-error';
import { CompanyService } from '../../../../core/data/company.service';
import { CashBankLedger, CashBankSummaryRow, Company } from '../../../../core/data/models';
import { DateRange, ReportService } from '../../../../core/data/report.service';
import { cashBankAccountLabel, cashBankEntryType } from '../../../../core/ledger/cash-bank-labels';
import { createCashBankPdf } from '../../../../core/ledger/cash-bank-pdf';
import { openPdfInNewTab, sharePdf } from '../../../../core/pdf/open-pdf';
import { ToastService } from '../../../../core/ui/toast.service';
import { round2 } from '../../../../core/gst/gst';
import { downloadCsv } from '../../../../core/ui/csv';
import { financialYear, formatDmy, formatTime } from '../../../../core/ui/dates';
import { Icon } from '../../../../shared/components/icon/icon';
import { BalancePipe } from '../../../../shared/pipes/balance.pipe';
import { InrPipe } from '../../../../shared/pipes/inr.pipe';
import { CashBankDocument } from '../cash-bank-document/cash-bank-document';

// "Cash & Bank" tab of Business Details (/settings?tab=cash-bank): cash in hand and every bank account — opening,
// money in (receipts), money out (payments to vendors) and closing for a period — and the chosen account's book
// with a running (daily) balance, like a ledger.
@Component({
  selector: 'app-cash-bank',
  imports: [Icon, InrPipe, BalancePipe, CashBankDocument],
  templateUrl: './cash-bank.html',
  styleUrl: './cash-bank.scss',
})
export class CashBank {
  private readonly reports = inject(ReportService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  // "Opening balances" button: back to the details tab, where they are entered.
  readonly editOpenings = output();

  protected readonly accounts = signal<CashBankSummaryRow[]>([]);
  protected readonly ledger = signal<CashBankLedger | null>(null);
  protected readonly company = signal<Company | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly pdfBusy = signal(false);

  // The period starts as the current financial year (1 April – 31 March).
  protected readonly from = signal(financialYear().from);
  protected readonly to = signal(financialYear().to);
  protected readonly rangeInvalid = computed(() => !!this.from() && !!this.to() && this.from() > this.to());
  // Account whose book is shown (?account=cash | bank-<id>), cash by default.
  protected readonly selected = signal(this.route.snapshot.queryParamMap.get('account') ?? 'cash');

  protected readonly label = cashBankAccountLabel;
  protected readonly totals = computed(() => {
    const sum = (key: 'periodOpening' | 'in' | 'out' | 'closing') => round2(this.accounts().reduce((t, a) => t + a[key], 0));
    return { periodOpening: sum('periodOpening'), in: sum('in'), out: sum('out'), closing: sum('closing') };
  });

  constructor() {
    inject(CompanyService)
      .get()
      .subscribe({ next: (company) => this.company.set(company) });
    this.load();
  }

  private range(): DateRange {
    return { ...(this.from() && { from: this.from() }), ...(this.to() && { to: this.to() }) };
  }

  protected load(): void {
    if (this.rangeInvalid()) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.reports.cashBank(this.range()).subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
        // The chosen account may have been removed: fall back to cash.
        if (!accounts.some((a) => a.key === this.selected())) this.selected.set('cash');
        this.loadLedger();
      },
      error: (err: unknown) => {
        this.loadError.set(toApiError(err).message);
        this.loading.set(false);
      },
    });
  }

  private loadLedger(): void {
    this.loading.set(true);
    this.reports.cashBankLedger(this.selected(), this.range()).subscribe({
      next: (ledger) => {
        this.ledger.set(ledger);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toApiError(err).message);
        this.loading.set(false);
      },
    });
  }

  protected select(key: string): void {
    if (key === this.selected() && this.ledger()?.account.key === key) return;
    this.selected.set(key);
    // Keep the choice in the URL, so coming back (e.g. from a receipt) shows the same book.
    this.router.navigate([], { queryParams: { account: key }, queryParamsHandling: 'merge', replaceUrl: true });
    this.loadLedger();
  }

  protected setDate(name: 'from' | 'to', value: string): void {
    this[name].set(value);
    this.load();
  }

  protected print(): void {
    window.print();
  }

  // "Cash-Book" / "Bank-Book-SBI-1234567890": PDF file name and share title.
  private pdfName(l: CashBankLedger): string {
    const name = l.account.type === 'cash' ? 'Cash Book' : `Bank Book ${cashBankAccountLabel(l.account).replace(/^Bank/, '')}`;
    return name.trim().replace(/[^\w]+/g, '-');
  }

  // Makes a real PDF of the book and opens it in a new tab (works on phones, where printing often doesn't).
  protected async openPdf(): Promise<void> {
    const l = this.ledger();
    if (!l || this.pdfBusy()) return;
    this.pdfBusy.set(true);
    try {
      await openPdfInNewTab(() => createCashBankPdf(l, this.company()), this.pdfName(l));
    } catch (err) {
      console.error('Open PDF failed', err);
      this.toast.error('Could not make the PDF. Please try again.');
    } finally {
      this.pdfBusy.set(false);
    }
  }

  // Sends the book as a PDF file via the phone's share sheet (WhatsApp, email…), or downloads it on desktop.
  protected async sharePdf(): Promise<void> {
    const l = this.ledger();
    if (!l || this.pdfBusy()) return;
    this.pdfBusy.set(true);
    try {
      const title = `${l.account.type === 'cash' ? 'Cash Book' : 'Bank Book'} – ${cashBankAccountLabel(l.account)}`;
      const result = await sharePdf(() => createCashBankPdf(l, this.company()), this.pdfName(l), title);
      if (result === 'downloaded') this.toast.success('PDF downloaded. Attach it to your email or chat to send it.');
    } catch (err) {
      console.error('Share PDF failed', err);
      this.toast.error('Could not make the PDF. Please try again.');
    } finally {
      this.pdfBusy.set(false);
    }
  }

  protected exportCsv(): void {
    const l = this.ledger();
    if (!l) return;
    const drCr = (n: number) => (n > 0 ? 'Dr' : n < 0 ? 'Cr' : '');
    const name = cashBankAccountLabel(l.account);
    downloadCsv(
      `${name.replace(/[^\w]+/g, '-').toLowerCase()}-book.csv`,
      ['Date', 'Time', 'Type', 'Vch No', 'Account', 'Debit (In)', 'Credit (Out)', 'Balance', 'Dr/Cr', 'Short Narration'],
      [
        ['', '', 'Opening', '', '', '', '', Math.abs(l.openingBalance), drCr(l.openingBalance), ''],
        ...l.entries.map((e) => [
          formatDmy(e.date),
          formatTime(e.createdAt),
          cashBankEntryType(e),
          e.number,
          e.party,
          e.debit || '',
          e.credit || '',
          Math.abs(e.balance),
          drCr(e.balance),
          e.reference,
        ]),
        ['', '', 'Total', '', '', l.totals.in, l.totals.out, '', '', ''],
        ['', '', 'Closing', '', '', '', '', Math.abs(l.totals.closingBalance), drCr(l.totals.closingBalance), ''],
      ],
    );
  }
}

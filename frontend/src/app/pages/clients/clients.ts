import { Component, computed, effect, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { ClientService } from '../../core/data/client.service';
import { CompanyService } from '../../core/data/company.service';
import { CashBankSummaryRow, Client, Company } from '../../core/data/models';
import { ReportService } from '../../core/data/report.service';
import { cashBankAccountLabel } from '../../core/ledger/cash-bank-labels';
import { createPartyListPdf } from '../../core/ledger/party-list-pdf';
import { openPdfInNewTab, sharePdf } from '../../core/pdf/open-pdf';
import { stateLabel } from '../../core/gst/gst-states';
import { downloadCsv } from '../../core/ui/csv';
import { todayIso } from '../../core/ui/dates';
import { paged } from '../../core/ui/paged';
import { ToastService } from '../../core/ui/toast.service';
import { ClientForm } from '../../shared/components/client-form/client-form';
import { Icon } from '../../shared/components/icon/icon';
import { Modal } from '../../shared/components/modal/modal';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ShowMore } from '../../shared/components/show-more/show-more';
import { BalancePipe } from '../../shared/pipes/balance.pipe';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { companyInput } from './cash-bank-accounts';
import { CashBankForm } from './components/cash-bank-form/cash-bank-form';

// Same limit as the backend.
const MAX_BANK_ACCOUNTS = 10;

@Component({
  selector: 'app-clients-page',
  imports: [PageHeader, Icon, Modal, ClientForm, BalancePipe, InrPipe, RouterLink, ShowMore, CashBankForm, NgTemplateOutlet],
  templateUrl: './clients.html',
  styleUrl: './clients.scss',
})
export class Clients {
  private readonly clientService = inject(ClientService);
  private readonly toast = inject(ToastService);
  private readonly companyService = inject(CompanyService);
  private readonly reports = inject(ReportService);

  protected readonly clients = signal<Client[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly search = signal('');

  // Add/edit modal: open with `editing` = the client, or null for a new one.
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Client | null>(null);
  protected readonly deleting = signal<Client | null>(null);
  protected readonly deleteBusy = signal(false);

  // Cash in hand and bank accounts (kept in Business Details), listed below the parties.
  protected readonly company = signal<Company | null>(null);
  protected readonly cashBank = signal<CashBankSummaryRow[]>([]);
  protected readonly cashBankFormOpen = signal(false);
  protected readonly editingAccount = signal<CashBankSummaryRow | null>(null);
  protected readonly deletingAccount = signal<CashBankSummaryRow | null>(null);
  protected readonly accountLabel = cashBankAccountLabel;
  protected readonly maxBankAccounts = MAX_BANK_ACCOUNTS;
  protected readonly filteredCashBank = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.cashBank();
    return this.cashBank().filter((a) => [cashBankAccountLabel(a), a.accountNo].some((v) => (v ?? '').toLowerCase().includes(term)));
  });

  protected readonly stateLabel = stateLabel;
  protected readonly pdfBusy = signal(false);
  protected readonly hasRows = computed(() => this.filtered().length > 0 || this.filteredCashBank().length > 0);
  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.clients();
    return this.clients().filter((c) =>
      [c.name, c.gstin, c.phone, c.email].some((value) => (value ?? '').toLowerCase().includes(term)),
    );
  });

  protected readonly page = paged(this.filtered);

  // Totals of the closing balances shown: Dr balances are receivable, Cr balances payable.
  protected readonly closingTotals = computed(() => {
    let receivable = 0;
    let payable = 0;
    for (const c of this.filtered()) {
      if (c.closingBalance > 0) receivable += c.closingBalance;
      else payable -= c.closingBalance;
    }
    return { receivable, payable };
  });

  constructor() {
    // A new search starts again from the first page.
    effect(() => {
      this.search();
      this.page.reset();
    });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.clientService.list().subscribe({
      next: (clients) => {
        this.clients.set(clients);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toApiError(err).message);
        this.loading.set(false);
      },
    });
    this.loadCashBank();
  }

  // All-time balances, like the parties: opening as entered, total in / out, closing now.
  private loadCashBank(): void {
    this.companyService.get(true).subscribe({ next: (company) => this.company.set(company) });
    this.reports.cashBank({}).subscribe({
      next: (accounts) => this.cashBank.set(accounts),
      error: (err: unknown) => this.toast.error(`Couldn't load cash & bank: ${toApiError(err).message}`),
    });
  }

  // Edit / delete only for cash and real bank accounts (not the catch-all "Bank" for entries without one).
  protected editableAccount(a: CashBankSummaryRow): boolean {
    return a.type === 'cash' || a.bankAccountId !== null;
  }

  protected ifscOf(a: CashBankSummaryRow): string | null {
    return this.company()?.bankAccounts.find((b) => b.id === a.bankAccountId)?.ifsc ?? null;
  }

  protected openCashBankForm(account: CashBankSummaryRow | null): void {
    if (!this.company()) return;
    this.editingAccount.set(account);
    this.cashBankFormOpen.set(true);
  }

  protected onCashBankSaved(company: Company): void {
    this.company.set(company);
    this.cashBankFormOpen.set(false);
    this.toast.success(this.editingAccount() ? 'Account saved' : 'Bank account added');
    this.loadCashBank();
  }

  protected confirmDeleteAccount(): void {
    const account = this.deletingAccount();
    const company = this.company();
    if (!account || !company || this.deleteBusy()) return;
    this.deleteBusy.set(true);
    const remaining = company.bankAccounts.filter((b) => b.id !== account.bankAccountId);
    this.companyService.update(companyInput(company, remaining, company.cashOpeningBalance ?? 0)).subscribe({
      next: (updated) => {
        this.company.set(updated);
        this.toast.success('Bank account removed');
        this.deletingAccount.set(null);
        this.deleteBusy.set(false);
        this.loadCashBank();
      },
      error: (err: unknown) => {
        this.toast.error(toApiError(err).message);
        this.deleteBusy.set(false);
      },
    });
  }

  // Download the list shown (search applied) for Excel, with each party's receivable / payable and the totals.
  protected exportExcel(): void {
    const money = (n: number) => Math.abs(n).toFixed(2);
    const side = (n: number) => (n > 0 ? 'Dr' : n < 0 ? 'Cr' : '');
    const { receivable, payable } = this.closingTotals();
    downloadCsv(
      `ledgers-party-detail-${todayIso()}.csv`,
      ['Name', 'Address', 'GSTIN', 'Phone', 'Email', 'State', 'Opening bal.', 'Dr/Cr', 'Debit', 'Credit', 'Closing bal.', 'Dr/Cr',
        'Receivable (Dr)', 'Payable (Cr)'],
      [
        ...this.filtered().map((c) => [
          c.name,
          c.address,
          c.gstin,
          c.phone,
          c.email,
          stateLabel(c.stateCode),
          money(c.openingBalance),
          side(c.openingBalance),
          c.debit.toFixed(2),
          c.credit.toFixed(2),
          money(c.closingBalance),
          side(c.closingBalance),
          c.closingBalance > 0 ? c.closingBalance.toFixed(2) : '',
          c.closingBalance < 0 ? money(c.closingBalance) : '',
        ]),
        ['Total', '', '', '', '', '', '', '', '', '', '', '', receivable.toFixed(2), payable.toFixed(2)],
        ...this.filteredCashBank().map((a) => [
          cashBankAccountLabel(a),
          '',
          '',
          '',
          '',
          '',
          money(a.periodOpening),
          side(a.periodOpening),
          a.in.toFixed(2),
          a.out.toFixed(2),
          money(a.closing),
          side(a.closing),
          '',
          '',
        ]),
      ],
    );
  }

  // The list shown (search applied) with cash & bank, as a PDF: in a new tab to view / print / save…
  protected async openPdf(): Promise<void> {
    if (!this.hasRows() || this.pdfBusy()) return;
    this.pdfBusy.set(true);
    try {
      await openPdfInNewTab(() => this.makePdf(), `Ledgers-party-detail-${todayIso()}`);
    } catch (err) {
      console.error('Open PDF failed', err);
      this.toast.error('Could not make the PDF. Please try again.');
    } finally {
      this.pdfBusy.set(false);
    }
  }

  // …or through the phone's share sheet (WhatsApp, email…); downloaded on desktop.
  protected async sharePdf(): Promise<void> {
    if (!this.hasRows() || this.pdfBusy()) return;
    this.pdfBusy.set(true);
    try {
      const result = await sharePdf(() => this.makePdf(), `Ledgers-party-detail-${todayIso()}`, 'Ledgers/Party Detail');
      if (result === 'downloaded') this.toast.success('PDF downloaded. Attach it to your email or chat to send it.');
    } catch (err) {
      console.error('Share PDF failed', err);
      this.toast.error('Could not make the PDF. Please try again.');
    } finally {
      this.pdfBusy.set(false);
    }
  }

  private makePdf(): Promise<Blob> {
    return createPartyListPdf(this.filtered(), this.filteredCashBank(), this.company());
  }

  protected openForm(client: Client | null): void {
    this.editing.set(client);
    this.formOpen.set(true);
  }

  protected onSaved(saved: Client): void {
    this.clients.update((list) => {
      const others = list.filter((c) => c.id !== saved.id);
      return [...others, saved].sort((a, b) => a.name.localeCompare(b.name));
    });
    this.formOpen.set(false);
  }

  protected confirmDelete(): void {
    const client = this.deleting();
    if (!client || this.deleteBusy()) return;
    this.deleteBusy.set(true);
    this.clientService.delete(client.id).subscribe({
      next: () => {
        this.clients.update((list) => list.filter((c) => c.id !== client.id));
        this.toast.success('Party deleted');
        this.deleting.set(null);
        this.deleteBusy.set(false);
      },
      error: (err: unknown) => {
        this.toast.error(toApiError(err).message);
        this.deleteBusy.set(false);
      },
    });
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { ClientService } from '../../core/data/client.service';
import { CompanyService } from '../../core/data/company.service';
import { Company, Ledger } from '../../core/data/models';
import { downloadCsv } from '../../core/ui/csv';
import { financialYear, formatDmy } from '../../core/ui/dates';
import { Icon } from '../../shared/components/icon/icon';
import { Modal } from '../../shared/components/modal/modal';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ReceiptForm } from '../../shared/components/receipt-form/receipt-form';
import { BalancePipe } from '../../shared/pipes/balance.pipe';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { LedgerDocument } from './components/ledger-document/ledger-document';

// /clients/:id — one customer's account ledger: sales, receipts and due / advance, date-wise.
@Component({
  selector: 'app-client-ledger-page',
  imports: [PageHeader, Icon, Modal, ReceiptForm, InrPipe, BalancePipe, RouterLink, LedgerDocument],
  templateUrl: './client-ledger.html',
  styleUrl: './client-ledger.scss',
})
export class ClientLedger {
  private readonly clients = inject(ClientService);
  private readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  protected readonly ledger = signal<Ledger | null>(null);
  protected readonly company = signal<Company | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly receiptOpen = signal(false);

  // The period starts as the current financial year (1 April – 31 March).
  protected readonly from = signal(financialYear().from);
  protected readonly to = signal(financialYear().to);
  protected readonly rangeInvalid = computed(() => !!this.from() && !!this.to() && this.from() > this.to());

  // Prefill for "Record receipt": whatever the customer currently owes.
  protected readonly dueAmount = computed(() => Math.max(this.ledger()?.client.balance ?? 0, 0) || null);

  constructor() {
    inject(CompanyService)
      .get()
      .subscribe({ next: (company) => this.company.set(company) });
    this.load();
  }

  protected load(): void {
    if (this.rangeInvalid()) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.clients.ledger(this.id, { ...(this.from() && { from: this.from() }), ...(this.to() && { to: this.to() }) }).subscribe({
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

  protected setDate(name: 'from' | 'to', value: string): void {
    this[name].set(value);
    this.load();
  }

  protected onReceiptSaved(): void {
    this.receiptOpen.set(false);
    this.load();
  }

  protected print(): void {
    window.print();
  }

  protected exportCsv(): void {
    const l = this.ledger();
    if (!l) return;
    const company = this.company();
    const bank = [company?.bankName, company?.accountNo].filter(Boolean).join(' ') || 'Bank';
    const drCr = (n: number) => (n > 0 ? 'Dr' : n < 0 ? 'Cr' : '');
    downloadCsv(
      `ledger-${l.client.name.replace(/[^\w]+/g, '-').toLowerCase()}.csv`,
      ['Date', 'Type', 'Vch/Bill No', 'Account', 'Debit', 'Credit', 'Balance', 'Dr/Cr', 'Short Narration'],
      [
        ['', 'Opening', '', '', '', '', Math.abs(l.openingBalance), drCr(l.openingBalance), ''],
        ...l.entries.map((e) => [
          formatDmy(e.date),
          e.type === 'sale' ? 'Sale' : 'Rcpt',
          e.invoiceNumber,
          e.type === 'sale' ? 'Sales' : e.mode === 'cash' ? 'Cash' : bank,
          e.debit || '',
          e.credit || '',
          Math.abs(e.balance),
          drCr(e.balance),
          e.reference,
        ]),
        ['', 'Total', '', '', l.totals.sales, l.totals.receipts, '', '', ''],
        ['', 'Closing', '', '', '', '', Math.abs(l.totals.closingBalance), drCr(l.totals.closingBalance), ''],
      ],
    );
  }
}

import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { CompanyService } from '../../core/data/company.service';
import { ItemService } from '../../core/data/item.service';
import { Company, StockLedger, StockLedgerEntry } from '../../core/data/models';
import { createStockLedgerPdf } from '../../core/ledger/stock-ledger-pdf';
import { openPdfInNewTab, sharePdf } from '../../core/pdf/open-pdf';
import { ToastService } from '../../core/ui/toast.service';
import { downloadCsv } from '../../core/ui/csv';
import { formatDmy } from '../../core/ui/dates';
import { Icon } from '../../shared/components/icon/icon';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';

// /items/:id — stock ledger of one product: opening stock, purchases in, sales out, stock in hand.
@Component({
  selector: 'app-item-ledger-page',
  imports: [PageHeader, Icon, RouterLink, DecimalPipe, InrPipe],
  templateUrl: './item-ledger.html',
  styleUrl: './item-ledger.scss',
})
export class ItemLedger {
  private readonly items = inject(ItemService);
  private readonly itemId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  private readonly toast = inject(ToastService);
  protected readonly company = signal<Company | null>(null);
  protected readonly pdfBusy = signal(false);

  protected readonly ledger = signal<StockLedger | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly formatDmy = formatDmy;
  protected readonly unit = computed(() => this.ledger()?.item.unit ?? '');
  // Like a ledger: opening stock on top, then entries oldest first (as the server returns them), so the
  // running balance reads downwards.
  protected readonly entries = computed(() => this.ledger()?.entries ?? []);

  constructor() {
    inject(CompanyService)
      .get()
      .subscribe({ next: (company) => this.company.set(company) });
    this.load();
  }

  protected print(): void {
    window.print();
  }

  // A real PDF of the stock ledger in a new tab (works on phones, where printing often doesn't).
  protected async openPdf(): Promise<void> {
    const ledger = this.ledger();
    if (!ledger || this.pdfBusy()) return;
    this.pdfBusy.set(true);
    try {
      await openPdfInNewTab(() => createStockLedgerPdf(ledger, this.company()), `Stock-ledger-${ledger.item.name}`);
    } catch (err) {
      console.error('Open PDF failed', err);
      this.toast.error('Could not make the PDF. Please try again.');
    } finally {
      this.pdfBusy.set(false);
    }
  }

  // Sends the PDF via the phone's share sheet (WhatsApp, email…), or downloads it on desktop.
  protected async sharePdf(): Promise<void> {
    const ledger = this.ledger();
    if (!ledger || this.pdfBusy()) return;
    this.pdfBusy.set(true);
    try {
      const result = await sharePdf(
        () => createStockLedgerPdf(ledger, this.company()),
        `Stock-ledger-${ledger.item.name}`,
        `Stock ledger – ${ledger.item.name}`,
      );
      if (result === 'downloaded') this.toast.success('PDF downloaded. Attach it to your email or chat to send it.');
    } catch (err) {
      console.error('Share PDF failed', err);
      this.toast.error('Could not make the PDF. Please try again.');
    } finally {
      this.pdfBusy.set(false);
    }
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.items.ledger(this.itemId).subscribe({
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

  // Purchases open the purchase bill, sales the invoice.
  protected link(e: StockLedgerEntry): (string | number)[] {
    return e.type === 'purchase' ? ['/purchases', e.id, 'edit'] : ['/invoices', e.id];
  }

  protected exportCsv(): void {
    const l = this.ledger();
    if (!l) return;
    downloadCsv(
      `stock-ledger-${l.item.name.replace(/[^\w]+/g, '-').toLowerCase()}.csv`,
      ['Date', 'Type', 'Vch/Bill No', 'Party', 'Rate', 'In', 'Out', 'Balance'],
      [
        ['', 'Opening stock', '', '', '', l.openingStock, '', l.openingStock],
        ...this.entries().map((e) => [
          formatDmy(e.date),
          e.type === 'purchase' ? 'Purchase' : 'Sale',
          e.number,
          e.party,
          e.rate,
          e.quantityIn || '',
          e.quantityOut || '',
          e.balance,
        ]),
        ['', '', 'Total', '', '', '', l.totals.purchased, l.totals.sold, ''],
        ['', '', 'In stock', '', '', '', '', '', l.totals.closingStock],
      ],
    );
  }
}

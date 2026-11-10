import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { ItemService } from '../../core/data/item.service';
import { StockLedger, StockLedgerEntry } from '../../core/data/models';
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

  protected readonly ledger = signal<StockLedger | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly formatDmy = formatDmy;
  protected readonly unit = computed(() => this.ledger()?.item.unit ?? '');

  constructor() {
    this.load();
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

  // Purchases open the payment, sales the invoice.
  protected link(e: StockLedgerEntry): (string | number)[] {
    return e.type === 'purchase' ? ['/payments', e.id, 'edit'] : ['/invoices', e.id];
  }

  protected exportCsv(): void {
    const l = this.ledger();
    if (!l) return;
    downloadCsv(
      `stock-ledger-${l.item.name.replace(/[^\w]+/g, '-').toLowerCase()}.csv`,
      ['Date', 'Type', 'Vch/Bill No', 'Vendor/Customer', 'Rate', 'In', 'Out', 'Balance'],
      [
        ['', 'Opening stock', '', '', '', l.openingStock, '', l.openingStock],
        ...l.entries.map((e) => [
          formatDmy(e.date),
          e.type === 'purchase' ? 'Purchase' : 'Sale',
          e.number,
          e.party,
          e.rate,
          e.quantityIn || '',
          e.quantityOut || '',
          e.balance,
        ]),
        ['', 'Total', '', '', '', l.totals.purchased, l.totals.sold, ''],
        ['', 'In stock', '', '', '', '', '', l.totals.closingStock],
      ],
    );
  }
}

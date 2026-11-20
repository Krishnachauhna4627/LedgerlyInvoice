import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { Purchase } from '../../core/data/models';
import { PurchaseService } from '../../core/data/purchase.service';
import { round2 } from '../../core/gst/gst';
import { stateName } from '../../core/gst/gst-states';
import { downloadCsv } from '../../core/ui/csv';
import { financialYear, formatDmy } from '../../core/ui/dates';
import { paged } from '../../core/ui/paged';
import { ToastService } from '../../core/ui/toast.service';
import { GstTotals, GstTotalsValue } from '../../shared/components/gst-totals/gst-totals';
import { Icon } from '../../shared/components/icon/icon';
import { Modal } from '../../shared/components/modal/modal';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ShowMore } from '../../shared/components/show-more/show-more';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { PurchaseTable } from './components/purchase-table/purchase-table';

// /purchases — purchase bills from vendors with the items bought, like invoices for sales.
@Component({
  selector: 'app-purchases-page',
  imports: [PageHeader, Icon, Modal, InrPipe, RouterLink, ShowMore, GstTotals, PurchaseTable],
  templateUrl: './purchases.html',
  styleUrl: './purchases.scss',
})
export class Purchases {
  private readonly service = inject(PurchaseService);
  private readonly toast = inject(ToastService);

  protected readonly purchases = signal<Purchase[]>([]);
  protected readonly page = paged(this.purchases);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  // Filters; the period starts as the current financial year, or the ?from= / ?to= dates of the link that
  // opened the page (the Purchases box on Reports; an empty value means no limit).
  private readonly urlFilters = inject(ActivatedRoute).snapshot.queryParamMap;
  protected readonly from = signal(this.urlDate('from') ?? financialYear().from);
  protected readonly to = signal(this.urlDate('to') ?? financialYear().to);
  protected readonly rangeInvalid = computed(() => !!this.from() && !!this.to() && this.from() > this.to());

  protected readonly deleting = signal<Purchase | null>(null);
  protected readonly deleteBusy = signal(false);

  protected readonly formatDmy = formatDmy;
  protected readonly totals = computed<GstTotalsValue>(() => {
    const sum = (key: keyof Purchase['totals']) => round2(this.purchases().reduce((total, p) => total + p.totals[key], 0));
    return { value: sum('grandTotal'), taxable: sum('subTotal'), igst: sum('totalIgst'), cgst: sum('totalCgst'), sgst: sum('totalSgst') };
  });
  protected readonly totalsNote = computed(() => {
    const n = this.purchases().length;
    return `${n} purchase invoice${n === 1 ? '' : 's'}`;
  });

  constructor() {
    this.load();
  }

  private urlDate(key: 'from' | 'to'): string | null {
    if (!this.urlFilters.has(key)) return null;
    const value = this.urlFilters.get(key) ?? '';
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
  }

  protected load(): void {
    if (this.rangeInvalid()) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.service.list({ from: this.from() || undefined, to: this.to() || undefined }).subscribe({
      next: (purchases) => {
        this.purchases.set(purchases);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toApiError(err).message);
        this.loading.set(false);
      },
    });
  }

  protected setFilter(name: 'from' | 'to', value: string): void {
    this[name].set(value);
    this.page.reset();
    this.load();
  }

  protected confirmDelete(): void {
    const purchase = this.deleting();
    if (!purchase || this.deleteBusy()) return;
    this.deleteBusy.set(true);
    this.service.delete(purchase.id).subscribe({
      next: () => {
        this.purchases.update((list) => list.filter((p) => p.id !== purchase.id));
        this.toast.success('Purchase deleted');
        this.deleting.set(null);
        this.deleteBusy.set(false);
      },
      error: (err: unknown) => {
        this.toast.error(toApiError(err).message);
        this.deleteBusy.set(false);
      },
    });
  }

  // Same columns as the table, one row per item. Party, GSTIN, state, doc no. and date repeat on every line so
  // the sheet can be filtered; the bill value is on the first line only, so summing it never counts a bill twice.
  protected exportCsv(): void {
    const money = (n: number) => n.toFixed(2);
    downloadCsv(
      `purchases${this.from() ? '-' + this.from() : ''}${this.to() ? '-to-' + this.to() : ''}.csv`,
      ['Party', 'GSTIN/UIN', 'Vendor state', 'Doc no.', 'Doc date', 'Qty', 'Unit', 'HSN', 'Particulars',
        'Invoice value', 'Taxable value', 'Tax rate (%)', 'IGST', 'CGST', 'SGST', 'Note'],
      this.purchases().flatMap((p) => {
        // No GST on this bill (a side without a GSTIN): the tax columns stay empty.
        const tax = (n: number) => (p.totals.totalTax ? money(n) : '');
        return p.lines.map((l, i) => [
          p.vendorName,
          p.vendorGstin,
          p.vendorStateCode ? `${p.vendorStateCode}-${stateName(p.vendorStateCode)}` : '',
          p.purchaseNumber,
          formatDmy(p.purchaseDate),
          l.quantity,
          l.unit,
          l.hsnSac,
          l.description,
          i === 0 ? money(p.totals.grandTotal) : '',
          money(l.taxableAmount),
          p.totals.totalTax ? l.gstRate : '',
          tax(l.igst),
          tax(l.cgst),
          tax(l.sgst),
          i === 0 ? p.note : '',
        ]);
      }),
    );
  }
}

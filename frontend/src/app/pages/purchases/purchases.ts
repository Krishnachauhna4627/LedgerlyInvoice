import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { Purchase } from '../../core/data/models';
import { PurchaseService } from '../../core/data/purchase.service';
import { round2 } from '../../core/gst/gst';
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

// /purchases — purchase bills from vendors with the items bought, like invoices for sales.
@Component({
  selector: 'app-purchases-page',
  imports: [PageHeader, Icon, Modal, InrPipe, TimePipe, RouterLink, ShowMore],
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

  // Filters; the period starts as the current financial year.
  protected readonly from = signal(financialYear().from);
  protected readonly to = signal(financialYear().to);
  protected readonly rangeInvalid = computed(() => !!this.from() && !!this.to() && this.from() > this.to());

  protected readonly deleting = signal<Purchase | null>(null);
  protected readonly deleteBusy = signal(false);

  protected readonly formatDmy = formatDmy;
  protected readonly totals = computed(() => {
    const sum = (key: 'subTotal' | 'totalTax' | 'grandTotal') => round2(this.purchases().reduce((total, p) => total + p.totals[key], 0));
    return { taxable: sum('subTotal'), gst: sum('totalTax'), all: sum('grandTotal') };
  });

  constructor() {
    this.load();
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

  // "Cement", or "Cement + 2 more".
  protected itemsText(p: Purchase): string {
    const [first, ...rest] = p.lines;
    if (!first) return '—';
    return rest.length ? `${first.description} + ${rest.length} more` : first.description;
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

  // One row per item, so the CSV shows everything bought.
  protected exportCsv(): void {
    downloadCsv(
      `purchases${this.from() ? '-' + this.from() : ''}${this.to() ? '-to-' + this.to() : ''}.csv`,
      ['Purchase No.', 'Date', 'Time', 'Vendor', 'Item', 'Qty', 'Unit', 'Rate', 'GST %', 'Taxable', 'GST', 'Line total', 'Bill total', 'Note'],
      this.purchases().flatMap((p) =>
        p.lines.map((l, i) => [
          p.purchaseNumber,
          formatDmy(p.purchaseDate),
          formatTime(p.createdAt),
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
          i === 0 ? p.note : '',
        ]),
      ),
    );
  }
}

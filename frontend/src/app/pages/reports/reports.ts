import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of, switchMap, tap } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { Purchase, PurchaseReport, SalesExportRow, SalesReport } from '../../core/data/models';
import { PurchaseService } from '../../core/data/purchase.service';
import { round2 } from '../../core/gst/gst';
import { DateRange, ReportService } from '../../core/data/report.service';
import { stateLabel } from '../../core/gst/gst-states';
import { downloadCsv } from '../../core/ui/csv';
import { PERIODS, Period, periodRange } from '../../core/ui/dates';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon/icon';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { InrPipe } from '../../shared/pipes/inr.pipe';

type PeriodChoice = Period | 'custom';

const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' });

// Sales and purchases for a date range side by side (drafts are not sales), with GST-ready CSV exports.
@Component({
  selector: 'app-reports-page',
  imports: [PageHeader, Icon, InrPipe],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports {
  private readonly reports = inject(ReportService);
  private readonly purchaseService = inject(PurchaseService);
  private readonly toast = inject(ToastService);

  protected readonly periods = PERIODS;
  protected readonly period = signal<PeriodChoice>('this_month');
  protected readonly from = signal(periodRange('this_month').from ?? '');
  protected readonly to = signal('');

  protected readonly report = signal<{ sales: SalesReport; purchases: PurchaseReport } | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly exporting = signal<'summary' | 'items' | 'purchases' | null>(null);

  private readonly range = computed<DateRange>(() => ({ from: this.from() || undefined, to: this.to() || undefined }));
  protected readonly rangeInvalid = computed(() => !!this.from() && !!this.to() && this.from() > this.to());

  // Sales vs purchases at a glance; GST collected on sales minus GST paid on purchases.
  protected readonly overview = computed(() => {
    const r = this.report();
    if (!r) return [];
    const s = r.sales.totals;
    const p = r.purchases.totals;
    return [
      { label: 'Sales', value: s.total, note: `${s.count} invoice${s.count === 1 ? '' : 's'}`, main: true },
      { label: 'Purchases', value: p.total, note: `${p.count} bill${p.count === 1 ? '' : 's'}`, main: true },
      { label: 'Sales − purchases', value: round2(s.total - p.total), note: 'Including GST', main: false },
      { label: 'GST on sales', value: s.tax, note: 'Output tax', main: false },
      { label: 'GST on purchases', value: p.tax, note: 'Input tax', main: false },
      { label: 'Net GST', value: round2(s.tax - p.tax), note: 'Sales GST − purchase GST', main: false },
    ];
  });

  protected readonly salesTiles = computed(() => {
    const t = this.report()?.sales.totals;
    if (!t) return [];
    return [
      { label: 'Taxable value', value: t.subTotal },
      { label: 'CGST', value: t.cgst },
      { label: 'SGST', value: t.sgst },
      { label: 'IGST', value: t.igst },
      { label: 'Total tax', value: t.tax },
      { label: 'Grand total', value: t.total },
    ];
  });

  // One row per month that has sales or purchases.
  protected readonly byMonth = computed(() => {
    const r = this.report();
    if (!r) return [];
    const months = [...new Set([...r.sales.byMonth.map((m) => m.month), ...r.purchases.byMonth.map((m) => m.month)])].sort();
    return months.map((month) => {
      const s = r.sales.byMonth.find((m) => m.month === month);
      const p = r.purchases.byMonth.find((m) => m.month === month);
      const sales = s?.total ?? 0;
      const purchases = p?.total ?? 0;
      return { month, invoices: s?.count ?? 0, sales, bills: p?.count ?? 0, purchases, difference: round2(sales - purchases) };
    });
  });

  constructor() {
    toObservable(this.range)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((range) =>
          this.rangeInvalid()
            ? of(null)
            : forkJoin({ sales: this.reports.sales(range), purchases: this.reports.purchases(range) }).pipe(
                catchError((err: unknown) => {
                  this.error.set(toApiError(err).message);
                  return of(null);
                }),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((report) => {
        this.report.set(report);
        this.loading.set(false);
      });
  }

  protected choosePeriod(value: string): void {
    const period = value as PeriodChoice;
    this.period.set(period);
    if (period !== 'custom') {
      const { from, to } = periodRange(period);
      this.from.set(from ?? '');
      this.to.set(to ?? '');
    }
  }

  protected setDate(which: 'from' | 'to', value: string): void {
    this.period.set('custom');
    (which === 'from' ? this.from : this.to).set(value);
  }

  protected monthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number);
    return MONTH.format(new Date(y, m - 1, 1));
  }

  protected export(kind: 'summary' | 'items'): void {
    if (this.exporting()) return;
    this.exporting.set(kind);
    this.reports.salesExport(this.range()).subscribe({
      next: (rows) => {
        this.exporting.set(null);
        if (rows.length === 0) {
          this.toast.error('No invoices in the selected date range.');
          return;
        }
        kind === 'summary' ? this.exportSummary(rows) : this.exportItems(rows);
      },
      error: (err: unknown) => {
        this.exporting.set(null);
        this.toast.error(toApiError(err).message);
      },
    });
  }

  // One row per item bought, from the purchase bills in the range.
  protected exportPurchases(): void {
    if (this.exporting()) return;
    this.exporting.set('purchases');
    this.purchaseService.list(this.range()).subscribe({
      next: (purchases) => {
        this.exporting.set(null);
        if (purchases.length === 0) {
          this.toast.error('No purchases in the selected date range.');
          return;
        }
        this.writePurchases(purchases);
      },
      error: (err: unknown) => {
        this.exporting.set(null);
        this.toast.error(toApiError(err).message);
      },
    });
  }

  private writePurchases(purchases: Purchase[]): void {
    downloadCsv(
      `purchase-item-details${this.fileSuffix()}.csv`,
      ['Purchase No.', 'Purchase Date', 'Vendor', 'Item No.', 'Description', 'HSN/SAC', 'Quantity', 'Unit', 'Rate',
        'GST Rate (%)', 'Taxable Value', 'GST', 'Line Total', 'Bill Total', 'Note'],
      [...purchases].reverse().flatMap((p) =>
        p.lines.map((l, index) => [
          p.purchaseNumber, p.purchaseDate, p.vendorName, index + 1, l.description, l.hsnSac, l.quantity, l.unit,
          l.unitPrice, l.gstRate, l.taxableAmount, l.totalTax, l.lineTotal, index === 0 ? p.totals.grandTotal : '', index === 0 ? p.note : '',
        ]),
      ),
    );
  }

  private fileSuffix(): string {
    const { from, to } = this.range();
    return from || to ? `_${from ?? 'start'}_to_${to ?? 'today'}` : '_all';
  }

  private exportSummary(rows: SalesExportRow[]): void {
    downloadCsv(
      `sales-invoice-summary${this.fileSuffix()}.csv`,
      ['Invoice Number', 'Invoice Date', 'Seller Name', 'Seller GSTIN', 'Client Name', 'Client Address', 'Client State',
        'Client GSTIN', 'Place of Supply', 'Reverse Charge', 'Item Count', 'Taxable Value', 'CGST', 'SGST', 'IGST',
        'Total Tax', 'Grand Total'],
      rows.map((r) => [
        r.invoiceNumber, r.invoiceDate, r.sellerName, r.sellerGstin, r.clientName, r.clientAddress,
        stateLabel(r.clientStateCode), r.clientGstin, stateLabel(r.placeOfSupplyCode), r.reverseCharge ? 'Yes' : 'No',
        r.lines.length, r.subTotal, r.totalCgst, r.totalSgst, r.totalIgst, r.totalTax, r.grandTotal,
      ]),
    );
  }

  private exportItems(rows: SalesExportRow[]): void {
    downloadCsv(
      `sales-item-details${this.fileSuffix()}.csv`,
      ['Invoice Number', 'Invoice Date', 'Seller Name', 'Seller GSTIN', 'Client Name', 'Client State Code', 'Client GSTIN',
        'Place of Supply', 'Reverse Charge', 'Item No.', 'Description', 'Narration', 'HSN/SAC', 'Quantity', 'Unit', 'Unit Price',
        'GST Rate (%)', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Tax', 'Line Total'],
      rows.flatMap((r) =>
        r.lines.map((l, index) => [
          r.invoiceNumber, r.invoiceDate, r.sellerName, r.sellerGstin, r.clientName, r.clientStateCode, r.clientGstin,
          stateLabel(r.placeOfSupplyCode), r.reverseCharge ? 'Yes' : 'No', index + 1, l.description, l.narration, l.hsnSac,
          l.quantity, l.unit, l.unitPrice, l.gstRate, l.taxableAmount, l.cgst, l.sgst, l.igst, l.totalTax, l.lineTotal,
        ]),
      ),
    );
  }
}

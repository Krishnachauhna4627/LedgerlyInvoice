import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, tap } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { SalesExportRow, SalesReport } from '../../core/data/models';
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

// Sales for a date range (drafts excluded by the server), with GST-ready CSV exports.
@Component({
  selector: 'app-reports-page',
  imports: [PageHeader, Icon, InrPipe],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports {
  private readonly reports = inject(ReportService);
  private readonly toast = inject(ToastService);

  protected readonly periods = PERIODS;
  protected readonly period = signal<PeriodChoice>('this_month');
  protected readonly from = signal(periodRange('this_month').from ?? '');
  protected readonly to = signal('');

  protected readonly report = signal<SalesReport | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly exporting = signal<'summary' | 'items' | null>(null);

  private readonly range = computed<DateRange>(() => ({ from: this.from() || undefined, to: this.to() || undefined }));
  protected readonly rangeInvalid = computed(() => !!this.from() && !!this.to() && this.from() > this.to());

  protected readonly tiles = computed(() => {
    const t = this.report()?.totals;
    if (!t) return [];
    return [
      { label: 'Invoices', value: String(t.count), money: false },
      { label: 'Taxable value', value: t.subTotal, money: true },
      { label: 'CGST', value: t.cgst, money: true },
      { label: 'SGST', value: t.sgst, money: true },
      { label: 'IGST', value: t.igst, money: true },
      { label: 'Total tax', value: t.tax, money: true },
      { label: 'Grand total', value: t.total, money: true },
    ];
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
            : this.reports.sales(range).pipe(
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

  private fileSuffix(): string {
    const { from, to } = this.range();
    return from || to ? `_${from ?? 'start'}_to_${to ?? 'today'}` : '_all';
  }

  private exportSummary(rows: SalesExportRow[]): void {
    downloadCsv(
      `sales-invoice-summary${this.fileSuffix()}.csv`,
      ['Invoice Number', 'Invoice Date', 'Seller Name', 'Seller GSTIN', 'Client Name', 'Client Address', 'Client State',
        'Client GSTIN', 'Place of Supply', 'Reverse Charge', 'IRN', 'Item Count', 'Taxable Value', 'CGST', 'SGST', 'IGST',
        'Total Tax', 'Grand Total'],
      rows.map((r) => [
        r.invoiceNumber, r.invoiceDate, r.sellerName, r.sellerGstin, r.clientName, r.clientAddress,
        stateLabel(r.clientStateCode), r.clientGstin, stateLabel(r.placeOfSupplyCode), r.reverseCharge ? 'Yes' : 'No',
        r.irn, r.lines.length, r.subTotal, r.totalCgst, r.totalSgst, r.totalIgst, r.totalTax, r.grandTotal,
      ]),
    );
  }

  private exportItems(rows: SalesExportRow[]): void {
    downloadCsv(
      `sales-item-details${this.fileSuffix()}.csv`,
      ['Invoice Number', 'Invoice Date', 'Seller Name', 'Seller GSTIN', 'Client Name', 'Client State Code', 'Client GSTIN',
        'Place of Supply', 'Reverse Charge', 'IRN', 'Item No.', 'Description', 'HSN/SAC', 'Quantity', 'Unit Price',
        'GST Rate (%)', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Tax', 'Line Total'],
      rows.flatMap((r) =>
        r.lines.map((l, index) => [
          r.invoiceNumber, r.invoiceDate, r.sellerName, r.sellerGstin, r.clientName, r.clientStateCode, r.clientGstin,
          stateLabel(r.placeOfSupplyCode), r.reverseCharge ? 'Yes' : 'No', r.irn, index + 1, l.description, l.hsnSac,
          l.quantity, l.unitPrice, l.gstRate, l.taxableAmount, l.cgst, l.sgst, l.igst, l.totalTax, l.lineTotal,
        ]),
      ),
    );
  }
}

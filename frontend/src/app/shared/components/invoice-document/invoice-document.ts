import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { Invoice } from '../../../core/data/models';
import { amountInWords } from '../../../core/gst/amount-in-words';
import { round2 } from '../../../core/gst/gst';
import { stateLabel } from '../../../core/gst/gst-states';
import { InrPipe } from '../../pipes/inr.pipe';

interface HsnRow {
  hsnSac: string;
  gstRate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
}

// The printable GST tax invoice. Layout is shared by all templates; only styling changes per template.
@Component({
  selector: 'app-invoice-document',
  imports: [InrPipe, DecimalPipe],
  templateUrl: './invoice-document.html',
  styleUrls: ['./invoice-document.scss', './invoice-document.templates.scss', './invoice-document.print.scss'],
  host: { '[class]': "'tpl-' + invoice().template" },
})
export class InvoiceDocument {
  readonly invoice = input.required<Invoice>();

  protected readonly stateLabel = stateLabel;
  protected readonly words = computed(() => amountInWords(this.invoice().totals.grandTotal));

  // HSN/SAC-wise tax summary, grouped by code and rate.
  protected readonly hsnSummary = computed<HsnRow[]>(() => {
    const groups = new Map<string, HsnRow>();
    for (const line of this.invoice().lines) {
      const hsnSac = line.hsnSac || '—';
      const key = `${hsnSac}|${line.gstRate}`;
      const row = groups.get(key) ?? { hsnSac, gstRate: line.gstRate, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 };
      row.taxable = round2(row.taxable + line.taxableAmount);
      row.cgst = round2(row.cgst + line.cgst);
      row.sgst = round2(row.sgst + line.sgst);
      row.igst = round2(row.igst + line.igst);
      row.tax = round2(row.tax + line.totalTax);
      groups.set(key, row);
    }
    return [...groups.values()];
  });

  protected formatDate(iso: string | null): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
}

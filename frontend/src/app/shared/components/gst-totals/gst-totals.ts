import { Component, computed, input } from '@angular/core';
import { InrPipe } from '../../pipes/inr.pipe';
import { Icon } from '../icon/icon';
import { IconName } from '../icon/icons';

export interface GstTotalsValue {
  value: number;
  taxable: number;
  igst: number;
  cgst: number;
  sgst: number;
}

// Five totals in a row — bill/invoice value, taxable value, IGST, CGST, SGST — above the invoices and purchases lists.
@Component({
  selector: 'app-gst-totals',
  imports: [Icon, InrPipe],
  templateUrl: './gst-totals.html',
  styleUrl: './gst-totals.scss',
})
export class GstTotals {
  readonly totals = input.required<GstTotalsValue>();
  readonly valueLabel = input('Invoice value');
  // Small text under the first box, e.g. "3 invoices".
  readonly note = input('');

  protected readonly boxes = computed<{ label: string; value: number; icon: IconName }[]>(() => {
    const t = this.totals();
    return [
      { label: this.valueLabel(), value: t.value, icon: 'rupee' },
      { label: 'Taxable value', value: t.taxable, icon: 'receipt' },
      { label: 'IGST', value: t.igst, icon: 'percent' },
      { label: 'CGST', value: t.cgst, icon: 'percent' },
      { label: 'SGST', value: t.sgst, icon: 'percent' },
    ];
  });
}

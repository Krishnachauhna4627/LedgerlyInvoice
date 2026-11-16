import { Component, computed, input } from '@angular/core';
import { InvoiceListItem } from '../../../../core/data/models';
import { Icon } from '../../../../shared/components/icon/icon';
import { IconName } from '../../../../shared/components/icon/icons';
import { InrPipe } from '../../../../shared/pipes/inr.pipe';

interface Box {
  label: string;
  value: number;
  icon: IconName;
}

// Five totals above the invoices list — invoice value, taxable value, IGST, CGST, SGST — for the
// invoices currently shown (after the date, status and search filters). Drafts aren't sales, so they're left out.
@Component({
  selector: 'app-invoice-totals',
  imports: [Icon, InrPipe],
  templateUrl: './invoice-totals.html',
  styleUrl: './invoice-totals.scss',
})
export class InvoiceTotals {
  readonly invoices = input.required<InvoiceListItem[]>();

  private readonly issued = computed(() => this.invoices().filter((i) => i.status !== 'draft'));

  protected readonly note = computed(() => {
    const n = this.issued().length;
    const drafts = this.invoices().length - n;
    return `${n} invoice${n === 1 ? '' : 's'}${drafts ? ` · ${drafts} draft${drafts === 1 ? '' : 's'} not counted` : ''}`;
  });

  protected readonly boxes = computed<Box[]>(() => {
    const sum = (pick: (i: InvoiceListItem) => number) => this.issued().reduce((total, i) => total + pick(i), 0);
    return [
      { label: 'Invoice value', value: sum((i) => i.grandTotal), icon: 'rupee' },
      { label: 'Taxable value', value: sum((i) => i.subTotal), icon: 'receipt' },
      { label: 'IGST', value: sum((i) => i.totalIgst), icon: 'percent' },
      { label: 'CGST', value: sum((i) => i.totalCgst), icon: 'percent' },
      { label: 'SGST', value: sum((i) => i.totalSgst), icon: 'percent' },
    ];
  });
}

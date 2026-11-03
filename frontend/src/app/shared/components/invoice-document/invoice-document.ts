import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { Invoice } from '../../../core/data/models';
import { amountInWords } from '../../../core/gst/amount-in-words';
import { stateLabel } from '../../../core/gst/gst-states';
import { formatInvoiceDate, hsnSummary, inclusiveRate } from '../../../core/invoices/invoice-summary';
import { InrPipe } from '../../pipes/inr.pipe';

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

  protected readonly hsnSummary = computed(() => hsnSummary(this.invoice().lines));
  protected readonly inclusiveRate = inclusiveRate;
  protected readonly formatDate = formatInvoiceDate;
}

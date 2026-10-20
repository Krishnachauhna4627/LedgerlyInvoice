import { DecimalPipe } from '@angular/common';
import { Component } from '@angular/core';
import { LogoMark } from '../../../../shared/components/logo-mark/logo-mark';
import { PREVIEW_ITEMS, PREVIEW_TOTALS } from '../product-preview/preview-data';

// Static picture of the generated tax invoice; not interactive.
@Component({
  selector: 'app-invoice-doc-preview',
  imports: [DecimalPipe, LogoMark],
  templateUrl: './invoice-doc-preview.html',
  styleUrl: './invoice-doc-preview.scss',
})
export class InvoiceDocPreview {
  protected readonly items = PREVIEW_ITEMS;
  protected readonly totals = PREVIEW_TOTALS;
  protected readonly actions = ['Print', 'Export PDF', 'Export Excel'];
}

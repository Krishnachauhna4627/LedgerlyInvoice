import { DecimalPipe } from '@angular/common';
import { Component } from '@angular/core';
import { Icon } from '../../../../shared/components/icon/icon';
import { PREVIEW_ITEMS } from '../product-preview/preview-data';

// Static picture of the invoice editor form; not interactive.
@Component({
  selector: 'app-invoice-form-preview',
  imports: [DecimalPipe, Icon],
  templateUrl: './invoice-form-preview.html',
  styleUrl: './invoice-form-preview.scss',
})
export class InvoiceFormPreview {
  protected readonly items = PREVIEW_ITEMS;
}

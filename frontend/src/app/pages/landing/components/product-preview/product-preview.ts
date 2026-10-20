import { Component } from '@angular/core';
import { Icon } from '../../../../shared/components/icon/icon';
import { IconName } from '../../../../shared/components/icon/icons';
import { LogoMark } from '../../../../shared/components/logo-mark/logo-mark';
import { InvoiceDocPreview } from '../invoice-doc-preview/invoice-doc-preview';
import { InvoiceFormPreview } from '../invoice-form-preview/invoice-form-preview';

@Component({
  selector: 'app-product-preview',
  imports: [Icon, LogoMark, InvoiceFormPreview, InvoiceDocPreview],
  templateUrl: './product-preview.html',
  styleUrl: './product-preview.scss',
})
export class ProductPreview {
  protected readonly tabs: { label: string; icon: IconName }[] = [
    { label: 'Invoice', icon: 'file-text' },
    { label: 'Customers', icon: 'users' },
    { label: 'Items', icon: 'box' },
    { label: 'Records', icon: 'receipt' },
    { label: 'Sales Report', icon: 'bar-chart' },
    { label: 'Seller Details', icon: 'building' },
  ];
}

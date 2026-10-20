import { Component } from '@angular/core';
import { Icon } from '../../../../shared/components/icon/icon';
import { IconName } from '../../../../shared/components/icon/icons';

@Component({
  selector: 'app-features',
  imports: [Icon],
  templateUrl: './features.html',
  styleUrl: './features.scss',
})
export class Features {
  protected readonly features: { icon: IconName; title: string; text: string }[] = [
    { icon: 'file-text', title: 'Create Invoices', text: 'Create professional GST invoices in seconds.' },
    { icon: 'users', title: 'Manage Customers', text: 'Store and manage customer details with GSTIN.' },
    { icon: 'box', title: 'Manage Items', text: 'Add products and services with HSN/SAC and GST rates.' },
    { icon: 'percent', title: 'Automatic GST', text: 'Calculate CGST, SGST or IGST automatically.' },
    { icon: 'file-text', title: 'Export & Print', text: 'Download invoices as PDF or export to Excel.' },
    { icon: 'bar-chart', title: 'Sales Reports', text: 'View your sales and GST reports easily.' },
  ];
}

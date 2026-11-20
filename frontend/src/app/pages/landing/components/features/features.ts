import { Component } from '@angular/core';
import { Icon } from '../../../../shared/components/icon/icon';
import { Reveal } from '../../../../shared/directives/reveal';
import { IconName } from '../../../../shared/components/icon/icons';

@Component({
  selector: 'app-features',
  imports: [Icon, Reveal],
  templateUrl: './features.html',
  styleUrl: './features.scss',
})
export class Features {
  protected readonly features: { icon: IconName; title: string; text: string }[] = [
    { icon: 'file-text', title: 'Create Invoices', text: 'Create professional GST invoices in seconds.' },
    { icon: 'users', title: 'Customer & Vendor Ledgers', text: 'Track transactions, GSTIN details, and real-time balances in one place.' },
    { icon: 'box', title: 'Manage Products/Services', text: 'Add products and services with HSN/SAC and GST rates.' },
    { icon: 'percent', title: 'Automatic GST', text: 'Calculate CGST, SGST or IGST automatically.' },
    { icon: 'file-text', title: 'Export & Print', text: 'Download invoices as PDF or export to Excel.' },
    { icon: 'bar-chart', title: 'Sales Reports', text: 'View your sales and GST reports easily.' },
    { icon: 'shopping-bag', title: 'Purchase Reports', text: 'See purchase invoices, input GST and payables at a glance.' },
    { icon: 'arrow-up-down', title: 'Stock Reports', text: 'Track stock in, stock out and current balance for every product.' },
  ];
}

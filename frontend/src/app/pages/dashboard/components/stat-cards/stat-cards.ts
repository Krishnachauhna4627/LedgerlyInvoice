import { Component } from '@angular/core';
import { Icon } from '../../../../shared/components/icon/icon';
import { IconName } from '../../../../shared/components/icon/icons';

interface Stat {
  label: string;
  value: string;
  icon: IconName;
}

// Values are zero until the invoice, customer and item modules exist and can supply real counts.
@Component({
  selector: 'app-stat-cards',
  imports: [Icon],
  templateUrl: './stat-cards.html',
  styleUrl: './stat-cards.scss',
})
export class StatCards {
  protected readonly stats: Stat[] = [
    { label: 'Sales this month', value: '₹0', icon: 'rupee' },
    { label: 'Invoices this month', value: '0', icon: 'file-text' },
    { label: 'Customers', value: '0', icon: 'users' },
    { label: 'Items', value: '0', icon: 'box' },
  ];
}

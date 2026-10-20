import { Component } from '@angular/core';
import { Icon } from '../../../../shared/components/icon/icon';

// Shows the empty state until the invoice module exists.
@Component({
  selector: 'app-recent-invoices',
  imports: [Icon],
  templateUrl: './recent-invoices.html',
  styleUrl: './recent-invoices.scss',
})
export class RecentInvoices {}

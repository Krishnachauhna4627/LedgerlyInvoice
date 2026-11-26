import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InvoiceListItem } from '../../../../core/data/models';
import { Icon } from '../../../../shared/components/icon/icon';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { InrPipe } from '../../../../shared/pipes/inr.pipe';

@Component({
  selector: 'app-recent-invoices',
  imports: [RouterLink, DatePipe, Icon, StatusBadge, InrPipe],
  templateUrl: './recent-invoices.html',
  styleUrl: './recent-invoices.scss',
})
export class RecentInvoices {
  readonly invoices = input.required<InvoiceListItem[]>();
}

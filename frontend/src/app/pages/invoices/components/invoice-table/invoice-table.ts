import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InvoiceListItem } from '../../../../core/data/models';
import { Icon } from '../../../../shared/components/icon/icon';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { InrPipe } from '../../../../shared/pipes/inr.pipe';

export interface MenuRequest {
  invoice: InvoiceListItem;
  anchor: HTMLElement;
}

// Wide table on md+; stacked cards on phones.
@Component({
  selector: 'app-invoice-table',
  imports: [RouterLink, DatePipe, Icon, StatusBadge, InrPipe],
  templateUrl: './invoice-table.html',
  styleUrl: './invoice-table.scss',
})
export class InvoiceTable {
  readonly invoices = input.required<InvoiceListItem[]>();
  readonly selected = input.required<ReadonlySet<number>>();
  readonly menuFor = input<number | null>(null);
  readonly toggle = output<number>();
  readonly toggleAll = output<boolean>();
  readonly openMenu = output<MenuRequest>();

  protected readonly allSelected = computed(
    () => this.invoices().length > 0 && this.invoices().every((i) => this.selected().has(i.id)),
  );
  protected readonly someSelected = computed(
    () => !this.allSelected() && this.invoices().some((i) => this.selected().has(i.id)),
  );

  protected menu(invoice: InvoiceListItem, event: MouseEvent): void {
    this.openMenu.emit({ invoice, anchor: event.currentTarget as HTMLElement });
  }
}

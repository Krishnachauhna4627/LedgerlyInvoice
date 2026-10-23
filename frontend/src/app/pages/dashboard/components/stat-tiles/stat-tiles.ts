import { Component, computed, input } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { DashboardSummary } from '../../../../core/data/models';
import { Icon } from '../../../../shared/components/icon/icon';
import { IconName } from '../../../../shared/components/icon/icons';
import { InrPipe } from '../../../../shared/pipes/inr.pipe';

interface Tile {
  label: string;
  value: string;
  note?: string;
  icon: IconName;
  tone?: 'danger';
  // Page the tile opens when clicked.
  link: string;
  query?: Params;
}

const inr = new InrPipe();
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

@Component({
  selector: 'app-stat-tiles',
  imports: [RouterLink, Icon],
  templateUrl: './stat-tiles.html',
  styleUrl: './stat-tiles.scss',
})
export class StatTiles {
  readonly summary = input.required<DashboardSummary>();

  protected readonly tiles = computed<Tile[]>(() => {
    const s = this.summary();
    return [
      { label: 'Sales this month', value: inr.transform(s.thisMonth.sales), note: plural(s.thisMonth.invoiceCount, 'invoice'), icon: 'rupee', link: '/invoices', query: { period: 'this_month' } },
      { label: 'Outstanding', value: inr.transform(s.outstanding.amount), note: `${plural(s.outstanding.count, 'invoice')} unpaid`, icon: 'receipt', link: '/invoices', query: { status: 'unpaid' } },
      {
        label: 'Overdue',
        value: inr.transform(s.overdue.amount),
        note: plural(s.overdue.count, 'invoice'),
        icon: 'alert-circle',
        tone: s.overdue.count > 0 ? 'danger' : undefined,
        link: '/invoices',
        query: { status: 'overdue' },
      },
      { label: 'Clients', value: String(s.clientCount), icon: 'users', link: '/clients' },
      { label: 'Items', value: String(s.itemCount), icon: 'box', link: '/items' },
    ];
  });
}

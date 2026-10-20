import { Component, computed, input } from '@angular/core';
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
}

const inr = new InrPipe();
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

@Component({
  selector: 'app-stat-tiles',
  imports: [Icon],
  templateUrl: './stat-tiles.html',
  styleUrl: './stat-tiles.scss',
})
export class StatTiles {
  readonly summary = input.required<DashboardSummary>();

  protected readonly tiles = computed<Tile[]>(() => {
    const s = this.summary();
    return [
      { label: 'Sales this month', value: inr.transform(s.thisMonth.sales), note: plural(s.thisMonth.invoiceCount, 'invoice'), icon: 'rupee' },
      { label: 'Outstanding', value: inr.transform(s.outstanding.amount), note: `${plural(s.outstanding.count, 'invoice')} unpaid`, icon: 'receipt' },
      {
        label: 'Overdue',
        value: inr.transform(s.overdue.amount),
        note: plural(s.overdue.count, 'invoice'),
        icon: 'alert-circle',
        tone: s.overdue.count > 0 ? 'danger' : undefined,
      },
      { label: 'Clients', value: String(s.clientCount), icon: 'users' },
      { label: 'Items', value: String(s.itemCount), icon: 'box' },
    ];
  });
}

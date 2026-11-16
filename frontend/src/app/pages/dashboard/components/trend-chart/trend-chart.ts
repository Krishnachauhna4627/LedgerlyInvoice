import { Component, computed, input, signal } from '@angular/core';
import { DashboardTrendMonth } from '../../../../core/data/models';
import { InrPipe } from '../../../../shared/pipes/inr.pipe';
import { compactInr, monthLabel, niceScale } from '../chart-format';

// Grouped bars of sales and purchases per month, with a hover/focus tooltip and a screen-reader table.
@Component({
  selector: 'app-trend-chart',
  imports: [InrPipe],
  templateUrl: './trend-chart.html',
  styleUrl: './trend-chart.scss',
})
export class TrendChart {
  readonly trend = input.required<DashboardTrendMonth[]>();

  // Month under the pointer / keyboard focus, for the tooltip.
  protected readonly active = signal<number | null>(null);

  protected readonly scale = computed(() => {
    const { top, step } = niceScale(Math.max(...this.trend().flatMap((m) => [m.sales, m.purchases]), 0));
    const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step).reverse();
    return { top, ticks: ticks.map((v) => ({ value: v, label: compactInr(v), pct: (v / top) * 100 })) };
  });

  protected readonly months = computed(() => {
    const top = this.scale().top;
    return this.trend().map((m) => ({
      ...m,
      label: monthLabel(m.month),
      salesPct: (m.sales / top) * 100,
      purchasesPct: (m.purchases / top) * 100,
    }));
  });

  protected readonly empty = computed(() => this.trend().every((m) => !m.sales && !m.purchases));
}

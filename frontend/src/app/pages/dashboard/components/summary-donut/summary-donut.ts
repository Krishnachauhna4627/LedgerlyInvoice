import { Component, computed, input } from '@angular/core';
import { InrPipe } from '../../../../shared/pipes/inr.pipe';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

// Two-part ring (e.g. received vs still receivable) with a value legend beside it.
@Component({
  selector: 'app-summary-donut',
  imports: [InrPipe],
  templateUrl: './summary-donut.html',
  styleUrl: './summary-donut.scss',
})
export class SummaryDonut {
  readonly title = input.required<string>();
  readonly slices = input.required<DonutSlice[]>();

  private static readonly R = 40;
  protected readonly circumference = 2 * Math.PI * SummaryDonut.R;
  protected readonly r = SummaryDonut.R;

  protected readonly total = computed(() => this.slices().reduce((sum, s) => sum + Math.max(s.value, 0), 0));

  // Each slice as a dash along the ring, with a 2px surface gap between slices.
  protected readonly arcs = computed(() => {
    const total = this.total();
    if (!total) return [];
    const c = this.circumference;
    const visible = this.slices().filter((s) => s.value > 0);
    const gap = visible.length > 1 ? 2 : 0;
    let offset = 0;
    return visible.map((s) => {
      const len = (s.value / total) * c;
      const arc = { color: s.color, dash: `${Math.max(len - gap, 0.5)} ${c}`, offset: -offset };
      offset += len;
      return arc;
    });
  });

  protected percent(value: number): string {
    const total = this.total();
    return total ? `${Math.round((Math.max(value, 0) / total) * 100)}%` : '0%';
  }
}

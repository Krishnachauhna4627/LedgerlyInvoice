import { Component, computed, input } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { Icon } from '../../../../shared/components/icon/icon';
import { IconName } from '../../../../shared/components/icon/icons';

export type TileTone = 'indigo' | 'orange' | 'green';

// One dashboard figure: label + icon, the value, a note, and optionally a sparkline of
// recent months and the % change from the previous period.
@Component({
  selector: 'app-stat-tile',
  imports: [RouterLink, Icon],
  templateUrl: './stat-tile.html',
  styleUrl: './stat-tile.scss',
  host: { '[attr.data-tone]': 'tone()' },
})
export class StatTile {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly note = input<string>();
  readonly icon = input.required<IconName>();
  readonly tone = input<TileTone>('indigo');
  readonly link = input.required<string>();
  readonly query = input<Params>();
  // Monthly values, oldest first; no sparkline when absent.
  readonly series = input<number[]>();
  readonly current = input<number>();
  readonly previous = input<number>();

  // % change from the previous period; null when it can't be worked out (nothing before).
  protected readonly change = computed(() => {
    const cur = this.current();
    const prev = this.previous();
    if (cur === undefined || prev === undefined) return null;
    if (prev === 0) return cur === 0 ? 0 : null;
    return ((cur - prev) / Math.abs(prev)) * 100;
  });

  protected readonly changeText = computed(() => {
    const c = this.change();
    if (c === null) return '';
    const rounded = Math.round(c * 10) / 10;
    return rounded === 0 ? '0%' : `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`;
  });

  // Sparkline paths in a 64×28 box (stretched to the tile; strokes don't scale).
  protected readonly spark = computed(() => {
    const values = this.series();
    if (!values?.length) return null;
    const w = 64;
    const h = 28;
    const max = Math.max(...values);
    const min = Math.min(...values, 0);
    const span = max - min || 1;
    const pts = values.map((v, i) => [
      values.length === 1 ? w : (i / (values.length - 1)) * w,
      // Flat (all-zero) series sit on the bottom edge.
      max === min ? h - 2 : h - 2 - ((v - min) / span) * (h - 6),
    ]);
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    return { line, area: `${line} L${w},${h} L0,${h} Z` };
  });
}

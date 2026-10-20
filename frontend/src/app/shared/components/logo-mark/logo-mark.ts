import { Component, computed, input } from '@angular/core';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-logo-mark',
  imports: [Icon],
  template: `<app-icon name="send" [size]="iconSize()" />`,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      flex-shrink: 0;
      border-radius: 25%;
      background: linear-gradient(135deg, var(--color-primary-light), var(--color-primary));
      color: var(--color-on-primary);
    }
  `,
  host: {
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    'aria-hidden': 'true',
  },
})
export class LogoMark {
  readonly size = input(44);

  protected readonly iconSize = computed(() => Math.round(this.size() * 0.5));
}

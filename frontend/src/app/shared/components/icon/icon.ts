import { Component, computed, input } from '@angular/core';
import { ICONS, IconName } from './icons';

// Decorative icon; always hidden from screen readers. Give the parent an accessible label if needed.
@Component({
  selector: 'app-icon',
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.stroke-width]="strokeWidth()"
    >
      @for (d of paths(); track $index) {
        <svg:path [attr.d]="d" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }
    /* Icons have a fixed size. The global svg { max-width: 100% } made browsers count them as 0px wide
       inside inline-flex boxes (e.g. status badges), pushing the label past the badge's border. */
    svg {
      max-width: none;
    }
  `,
  host: { 'aria-hidden': 'true' },
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly strokeWidth = input(2);

  protected readonly paths = computed(() => ICONS[this.name()]);
}

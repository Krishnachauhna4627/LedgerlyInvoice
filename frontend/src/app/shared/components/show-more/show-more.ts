import { Component, computed, input, output } from '@angular/core';
import { PAGE_SIZE } from '../../../core/ui/paged';

// "Show more" button under a list rendered with paged(); hidden once everything is shown.
@Component({
  selector: 'app-show-more',
  template: `
    @if (remaining() > 0) {
      <button type="button" class="btn btn--outline" (click)="more.emit()">
        Show {{ next() }} more <span class="left">({{ remaining() }} not shown)</span>
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      justify-content: center;
    }
    button {
      margin: var(--space-4);
    }
    .left {
      color: var(--color-text-muted);
      font-size: var(--text-xs);
    }
  `,
})
export class ShowMore {
  readonly remaining = input.required<number>();
  readonly pageSize = input(PAGE_SIZE);
  readonly more = output<void>();

  protected readonly next = computed(() => Math.min(this.remaining(), this.pageSize()));
}

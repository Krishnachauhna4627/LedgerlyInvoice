import { Component, computed, input } from '@angular/core';
import { DisplayStatus } from '../../../core/data/models';
import { Icon } from '../icon/icon';
import { IconName } from '../icon/icons';

const STATUS: Record<DisplayStatus, { label: string; icon: IconName }> = {
  paid: { label: 'Paid', icon: 'check' },
  unpaid: { label: 'Unpaid', icon: 'receipt' },
  overdue: { label: 'Overdue', icon: 'alert-circle' },
  draft: { label: 'Draft', icon: 'pencil' },
};

@Component({
  selector: 'app-status-badge',
  imports: [Icon],
  template: `<span class="badge badge--{{ status() }}"><app-icon [name]="meta().icon" [size]="12" [strokeWidth]="2.5" />{{ meta().label }}</span>`,
})
export class StatusBadge {
  readonly status = input.required<DisplayStatus>();
  protected readonly meta = computed(() => STATUS[this.status()]);
}

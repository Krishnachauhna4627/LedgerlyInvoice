import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../../shared/components/icon/icon';
import { IconName } from '../../../../shared/components/icon/icons';

export interface SetupStep {
  label: string;
  hint: string;
  link: string;
  done: boolean;
  icon: IconName;
}

// Setup checklist; the dashboard hides it once every step is done.
@Component({
  selector: 'app-get-started',
  imports: [RouterLink, Icon],
  templateUrl: './get-started.html',
  styleUrl: './get-started.scss',
})
export class GetStarted {
  readonly steps = input.required<SetupStep[]>();
  protected readonly doneCount = computed(() => this.steps().filter((s) => s.done).length);
}

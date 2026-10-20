import { Component } from '@angular/core';
import { Icon } from '../../../../shared/components/icon/icon';
import { IconName } from '../../../../shared/components/icon/icons';

@Component({
  selector: 'app-how-it-works',
  imports: [Icon],
  templateUrl: './how-it-works.html',
  styleUrl: './how-it-works.scss',
})
export class HowItWorks {
  protected readonly steps: { icon: IconName; title: string; text: string }[] = [
    { icon: 'building', title: 'Set up your business', text: 'Add your business details and GSTIN once.' },
    { icon: 'file-text', title: 'Create invoices', text: 'Add customers, items and generate invoices instantly.' },
    { icon: 'bar-chart', title: 'Track and export', text: 'View reports and export to PDF or Excel.' },
  ];
}

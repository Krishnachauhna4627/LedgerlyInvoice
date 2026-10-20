import { Component } from '@angular/core';
import { Icon } from '../../../../shared/components/icon/icon';
import { IconName } from '../../../../shared/components/icon/icons';

// Each action becomes a link once its module is built.
@Component({
  selector: 'app-quick-actions',
  imports: [Icon],
  templateUrl: './quick-actions.html',
  styleUrl: './quick-actions.scss',
})
export class QuickActions {
  protected readonly actions: { icon: IconName; title: string; text: string }[] = [
    { icon: 'building', title: 'Seller details', text: 'Add your business address and GSTIN.' },
    { icon: 'users', title: 'Add a customer', text: 'Save customer details with GSTIN.' },
    { icon: 'box', title: 'Add an item', text: 'Products or services with HSN/SAC and GST rate.' },
    { icon: 'file-text', title: 'Create an invoice', text: 'Bill a customer in seconds.' },
  ];
}

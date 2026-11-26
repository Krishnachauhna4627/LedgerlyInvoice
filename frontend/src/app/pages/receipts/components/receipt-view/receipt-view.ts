import { Component, computed, input, output } from '@angular/core';
import { Company, Receipt } from '../../../../core/data/models';
import { amountInWords } from '../../../../core/gst/amount-in-words';
import { oneLineAddress } from '../../../../core/ledger/ledger-labels';
import { receiptAccountLabel } from '../../../../core/receipts/receipt-labels';
import { formatDmy } from '../../../../core/ui/dates';
import { Icon } from '../../../../shared/components/icon/icon';
import { InrPipe } from '../../../../shared/pipes/inr.pipe';

// Read-only receipt (same details as the printed receipt) with Print / Edit actions; shown in a modal.
@Component({
  selector: 'app-receipt-view',
  imports: [Icon, InrPipe],
  templateUrl: './receipt-view.html',
  styleUrl: './receipt-view.scss',
})
export class ReceiptView {
  readonly receipt = input.required<Receipt>();
  readonly company = input<Company | null>(null);
  readonly printing = input(false);
  // Opened from a customer ledger: show "Back to ledger".
  readonly showBack = input(false);
  readonly back = output();
  readonly print = output();
  readonly edit = output();
  readonly closed = output();

  protected readonly formatDmy = formatDmy;
  protected readonly address = computed(() => oneLineAddress(this.company()?.address));
  protected readonly words = computed(() => amountInWords(this.receipt().amount));
  protected readonly account = computed(() => receiptAccountLabel(this.receipt(), this.company()));
}

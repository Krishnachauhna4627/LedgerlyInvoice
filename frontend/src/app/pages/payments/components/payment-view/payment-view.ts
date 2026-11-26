import { Component, computed, input, output } from '@angular/core';
import { Company, VendorPayment } from '../../../../core/data/models';
import { amountInWords } from '../../../../core/gst/amount-in-words';
import { oneLineAddress } from '../../../../core/ledger/ledger-labels';
import { receiptAccountLabel } from '../../../../core/receipts/receipt-labels';
import { formatDmy } from '../../../../core/ui/dates';
import { Icon } from '../../../../shared/components/icon/icon';
import { InrPipe } from '../../../../shared/pipes/inr.pipe';

// Read-only payment voucher (same details as the printed voucher) with Print / Edit actions; shown in a modal.
// Same layout as the receipt view, so it shares its stylesheet.
@Component({
  selector: 'app-payment-view',
  imports: [Icon, InrPipe],
  templateUrl: './payment-view.html',
  styleUrl: '../../../receipts/components/receipt-view/receipt-view.scss',
})
export class PaymentView {
  readonly payment = input.required<VendorPayment>();
  readonly company = input<Company | null>(null);
  readonly printing = input(false);
  // Opened from a party ledger: show "Back to ledger".
  readonly showBack = input(false);
  readonly back = output();
  readonly print = output();
  readonly edit = output();
  readonly closed = output();

  protected readonly formatDmy = formatDmy;
  protected readonly address = computed(() => oneLineAddress(this.company()?.address));
  protected readonly words = computed(() => amountInWords(this.payment().amount));
  protected readonly account = computed(() => receiptAccountLabel(this.payment(), this.company()));
}

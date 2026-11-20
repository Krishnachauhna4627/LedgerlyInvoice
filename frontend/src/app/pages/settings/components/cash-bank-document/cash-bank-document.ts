import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CashBankLedger, Company } from '../../../../core/data/models';
import { cashBankAccountLabel, cashBankEntryType } from '../../../../core/ledger/cash-bank-labels';
import { ledgerPeriod, oneLineAddress } from '../../../../core/ledger/ledger-labels';
import { formatDmy } from '../../../../core/ui/dates';
import { BalancePipe } from '../../../../shared/pipes/balance.pipe';
import { InrPipe } from '../../../../shared/pipes/inr.pipe';
import { TimePipe } from '../../../../shared/pipes/time.pipe';

// Printable cash book / bank book in the same layout as the customer "Account Ledger": business header,
// period, opening balance, date-wise receipts (debit, money in) and payments (credit, money out) with a
// running balance, totals and closing balance.
@Component({
  selector: 'app-cash-bank-document',
  imports: [InrPipe, BalancePipe, TimePipe, RouterLink],
  templateUrl: './cash-bank-document.html',
  // Same look as the customer ledger.
  styleUrl: '../../../client-ledger/components/ledger-document/ledger-document.scss',
})
export class CashBankDocument {
  readonly ledger = input.required<CashBankLedger>();
  readonly company = input<Company | null>(null);

  protected readonly formatDmy = formatDmy;
  protected readonly type = cashBankEntryType;
  protected readonly address = computed(() => oneLineAddress(this.company()?.address));
  protected readonly period = computed(() => ledgerPeriod(this.ledger()));
  protected readonly accountLabel = computed(() => cashBankAccountLabel(this.ledger().account));
  protected readonly title = computed(() => (this.ledger().account.type === 'cash' ? 'Cash Book' : 'Bank Book'));
}

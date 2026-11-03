import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Company, Ledger, LedgerEntry } from '../../../../core/data/models';
import { ledgerAccount, ledgerPeriod, oneLineAddress } from '../../../../core/ledger/ledger-labels';
import { formatDmy } from '../../../../core/ui/dates';
import { BalancePipe } from '../../../../shared/pipes/balance.pipe';
import { InrPipe } from '../../../../shared/pipes/inr.pipe';

// Printable "Account Ledger" of one customer: business header, period, opening balance,
// date-wise sales (debit) and receipts (credit) with running balance, totals and closing balance.
@Component({
  selector: 'app-ledger-document',
  imports: [InrPipe, BalancePipe, RouterLink],
  templateUrl: './ledger-document.html',
  styleUrl: './ledger-document.scss',
})
export class LedgerDocument {
  readonly ledger = input.required<Ledger>();
  readonly company = input<Company | null>(null);

  protected readonly formatDmy = formatDmy;

  protected readonly address = computed(() => oneLineAddress(this.company()?.address));
  protected readonly period = computed(() => ledgerPeriod(this.ledger()));

  protected account(entry: LedgerEntry): string {
    return ledgerAccount(entry, this.company());
  }
}

import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Company, Ledger, LedgerEntry } from '../../../../core/data/models';
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

  protected readonly address = computed(() =>
    (this.company()?.address ?? '')
      .split(/\n+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', '),
  );

  protected readonly period = computed(() => {
    const { from, to } = this.ledger();
    if (from && to) return `From ${formatDmy(from)} to ${formatDmy(to)}`;
    if (from) return `From ${formatDmy(from)}`;
    return to ? `Up to ${formatDmy(to)}` : 'All entries';
  });

  // "Account" column: Sales for invoices, Cash, or the business's bank account for bank receipts.
  protected account(entry: LedgerEntry): string {
    if (entry.type === 'sale') return 'Sales';
    if (entry.mode === 'cash') return 'Cash';
    const c = this.company();
    return [c?.bankName, c?.accountNo].filter(Boolean).join(' ') || 'Bank';
  }
}

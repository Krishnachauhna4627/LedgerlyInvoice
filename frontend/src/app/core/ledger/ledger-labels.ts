import { Company, Ledger, LedgerEntry } from '../data/models';
import { receiptAccountLabel } from '../receipts/receipt-labels';
import { formatDmy } from '../ui/dates';

// Labels shared by the on-screen customer ledger and its PDF.

// "From 01-04-2026 to 31-03-2027", "Up to …" or "All entries".
export function ledgerPeriod({ from, to }: Pick<Ledger, 'from' | 'to'>): string {
  if (from && to) return `From ${formatDmy(from)} to ${formatDmy(to)}`;
  if (from) return `From ${formatDmy(from)}`;
  return to ? `Up to ${formatDmy(to)}` : 'All entries';
}

// "Account" column: Sales for invoices, Cash, or the bank account for bank receipts.
export function ledgerAccount(entry: LedgerEntry, company: Company | null): string {
  return entry.type === 'sale' ? 'Sales' : receiptAccountLabel(entry, company);
}

// Business address on one line.
export function oneLineAddress(address: string | null | undefined): string {
  return (address ?? '')
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
}

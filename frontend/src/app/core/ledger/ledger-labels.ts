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

// "Type" column.
const ENTRY_TYPES: Record<LedgerEntry['type'], string> = { sale: 'Sale', receipt: 'Rcpt', purchase: 'Purc', payment: 'Pymt' };
export const ledgerEntryType = (entry: LedgerEntry): string => ENTRY_TYPES[entry.type];

// "Account" column: Sales / Purchase for bills; Cash or the bank account for receipts and payments.
export function ledgerAccount(entry: LedgerEntry, company: Company | null): string {
  if (entry.type === 'sale') return 'Sales';
  if (entry.type === 'purchase') return 'Purchase';
  return receiptAccountLabel(entry, company);
}

// Business address on one line.
export function oneLineAddress(address: string | null | undefined): string {
  return (address ?? '')
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
}

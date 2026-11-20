import { CashBankAccount, CashBankEntry } from '../data/models';
import { bankAccountLabel } from '../receipts/receipt-labels';

// Labels shared by the cash & bank page, its printed book and its CSV.

// "Cash", "Bank · SBI 1234567890", or "Bank" for bank entries saved without an account.
export function cashBankAccountLabel(account: CashBankAccount): string {
  if (account.type === 'cash') return 'Cash';
  const label = bankAccountLabel(account);
  return label ? `Bank · ${label}` : 'Bank';
}

// "Type" column, like the customer ledger: Rcpt (money in) / Pymt (money out).
export const cashBankEntryType = (entry: CashBankEntry): string => (entry.type === 'receipt' ? 'Rcpt' : 'Pymt');

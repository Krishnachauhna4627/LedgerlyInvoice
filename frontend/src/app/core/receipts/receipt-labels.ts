import { BankAccountRef, Company, ReceiptMode } from '../data/models';

// "SBI 1234567890", or null when the account has neither a bank name nor a number.
export function bankAccountLabel(account: BankAccountRef | null | undefined): string | null {
  return [account?.bankName, account?.accountNo].filter(Boolean).join(' ') || null;
}

// Where the money went: "Cash", the receipt's bank account, or (for receipts saved without one)
// the business's primary account, else plain "Bank".
export function receiptAccountLabel(
  receipt: { mode: ReceiptMode | null; bankAccount?: BankAccountRef | null },
  company: Company | null,
): string {
  if (receipt.mode === 'cash') return 'Cash';
  return bankAccountLabel(receipt.bankAccount) ?? bankAccountLabel(company) ?? 'Bank';
}

import { Company, VendorPayment } from '../data/models';
import { createVoucherPdf } from '../receipts/receipt-pdf';
import { bankAccountLabel } from '../receipts/receipt-labels';

// One payment to a vendor as an A4 PDF, laid out like a receipt ("PAYMENT VOUCHER", "Paid to").
export function createPaymentPdf(payment: VendorPayment, company: Company | null, autoPrint = true): Promise<Blob> {
  const account = payment.mode === 'cash' ? null : bankAccountLabel(payment.bankAccount);
  return createVoucherPdf(
    {
      title: 'PAYMENT VOUCHER',
      numberLabel: 'Payment No.',
      number: payment.paymentNumber,
      date: payment.paymentDate,
      createdAt: payment.createdAt,
      partyLabel: 'Paid to',
      partyName: payment.vendorName,
      amount: payment.amount,
      modeText: payment.mode === 'cash' ? 'Cash' : account ? `Bank (${account})` : 'Bank',
      reference: payment.reference,
    },
    company,
    autoPrint,
  );
}

import { InvoiceListItem } from '../../core/data/models';
import { downloadCsv } from '../../core/ui/csv';
import { todayIso } from '../../core/ui/dates';

const STATUS_LABEL = { draft: 'Draft', unpaid: 'Unpaid', overdue: 'Overdue', paid: 'Paid' } as const;

// Exports the given rows (the filtered list, or just the selected ones).
export function exportInvoicesCsv(rows: InvoiceListItem[]): void {
  downloadCsv(
    `invoices-${todayIso()}.csv`,
    ['Invoice No', 'Date', 'Due date', 'Client', 'Client GSTIN', 'Items', 'Taxable', 'Tax', 'Total', 'Status'],
    rows.map((r) => [
      r.invoiceNumber,
      r.invoiceDate,
      r.dueDate,
      r.clientName,
      r.clientGstin,
      r.itemCount,
      r.subTotal.toFixed(2),
      r.totalTax.toFixed(2),
      r.grandTotal.toFixed(2),
      STATUS_LABEL[r.displayStatus],
    ]),
  );
}

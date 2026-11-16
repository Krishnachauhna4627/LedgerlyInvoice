import { InvoiceListItem } from '../../core/data/models';
import { stateName } from '../../core/gst/gst-states';
import { downloadCsv } from '../../core/ui/csv';
import { formatDmy, todayIso } from '../../core/ui/dates';

const STATUS_LABEL = { draft: 'Draft', unpaid: 'Unpaid', overdue: 'Overdue', paid: 'Paid' } as const;

const HEADERS = [
  'Party', 'GSTIN/UIN', 'Place of supply', 'Doc no.', 'Doc date', 'Qty', 'Unit', 'HSN', 'Particulars',
  'Invoice value', 'Taxable value', 'Tax rate (%)', 'IGST', 'CGST', 'SGST', 'Amount due', 'Status',
];

const money = (n: number) => n.toFixed(2);

// Exports the given rows (the filtered list, or just the selected ones) with the same columns as the
// invoices table: one row per invoice line. Party, GSTIN, place of supply, doc no. and date repeat on every
// line so the sheet can be filtered; invoice value, amount due and status are on the first line only, so
// summing a column never counts an invoice twice.
export function exportInvoicesCsv(rows: InvoiceListItem[]): void {
  downloadCsv(
    `invoices-${todayIso()}.csv`,
    HEADERS,
    rows.flatMap((inv) => {
      const party = [
        inv.clientName,
        inv.clientGstin,
        inv.placeOfSupplyCode ? `${inv.placeOfSupplyCode}-${stateName(inv.placeOfSupplyCode)}` : '',
        inv.invoiceNumber,
        formatDmy(inv.invoiceDate),
      ];
      const invoiceOnly = (first: boolean) => ({
        value: first ? money(inv.grandTotal) : '',
        due: first ? money(inv.amountDue) : '',
        status: first ? STATUS_LABEL[inv.displayStatus] : '',
      });
      const lines = inv.lines ?? [];

      // No lines: one row with the invoice's own totals.
      if (!lines.length) {
        const { value, due, status } = invoiceOnly(true);
        return [[
          ...party, '', '', '', '', value, money(inv.subTotal), '',
          money(inv.totalIgst), money(inv.totalCgst), money(inv.totalSgst), due, status,
        ]];
      }
      return lines.map((line, i) => {
        const { value, due, status } = invoiceOnly(i === 0);
        return [
          ...party, line.quantity, line.unit, line.hsnSac, line.description, value, money(line.taxableAmount),
          line.gstRate, money(line.igst), money(line.cgst), money(line.sgst), due, status,
        ];
      });
    }),
  );
}

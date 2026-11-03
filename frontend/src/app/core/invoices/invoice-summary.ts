import { InvoiceLine } from '../data/models';
import { round2 } from '../gst/gst';

// Figures shared by the on-screen invoice and the PDF export.

export interface HsnRow {
  hsnSac: string;
  gstRate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
}

// HSN/SAC-wise tax summary, grouped by code and rate.
export function hsnSummary(lines: InvoiceLine[]): HsnRow[] {
  const groups = new Map<string, HsnRow>();
  for (const line of lines) {
    const hsnSac = line.hsnSac || '—';
    const key = `${hsnSac}|${line.gstRate}`;
    const row = groups.get(key) ?? { hsnSac, gstRate: line.gstRate, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 };
    row.taxable = round2(row.taxable + line.taxableAmount);
    row.cgst = round2(row.cgst + line.cgst);
    row.sgst = round2(row.sgst + line.sgst);
    row.igst = round2(row.igst + line.igst);
    row.tax = round2(row.tax + line.totalTax);
    groups.set(key, row);
  }
  return [...groups.values()];
}

// Per-unit price including tax, for sellers without a GSTIN.
export function inclusiveRate(line: InvoiceLine): number {
  return line.quantity ? round2(line.lineTotal / line.quantity) : line.lineTotal;
}

// 'YYYY-MM-DD' → 'DD/MM/YYYY', as printed on invoices.
export function formatInvoiceDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

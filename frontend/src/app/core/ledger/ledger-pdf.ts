import { Company, Ledger } from '../data/models';
import { BOTTOM, CONTENT_WIDTH, FONT, MARGIN, PAGE, TOP_CONTINUED, finalY, lineHeight, money, newPdf, themeColors } from '../pdf/pdf-kit';
import { formatDmy } from '../ui/dates';
import { ledgerAccount, ledgerPeriod, oneLineAddress } from './ledger-labels';

// Builds one customer's "Account Ledger" as a real A4 PDF (tables drawn with jspdf-autotable),
// laid out like <app-ledger-document>: business header, title bar, account / period / opening
// balance, date-wise entries with running balance, totals and closing balance.

// 1234.5 → "1,234.50 Dr", -10 → "10.00 Cr", 0 → "0.00"
const balance = (n: number) => `${money(Math.abs(n))}${n > 0 ? ' Dr' : n < 0 ? ' Cr' : ''}`;

export async function createLedgerPdf(ledger: Ledger, company: Company | null): Promise<Blob> {
  const { doc, autoTable } = await newPdf(`Ledger - ${ledger.client.name}`, company?.name ?? '');
  const c = themeColors();
  const right = MARGIN + CONTENT_WIDTH;
  let y = MARGIN;

  // Business header
  if (company?.name) {
    doc.setFont(FONT, 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...c.text);
    y += lineHeight(14);
    doc.text(company.name.toUpperCase(), PAGE.width / 2, y - 1.2, { align: 'center', maxWidth: CONTENT_WIDTH });
  }
  const address = oneLineAddress(company?.address);
  if (address) {
    doc.setFont(FONT, 'bold');
    doc.setFontSize(9);
    for (const line of doc.splitTextToSize(address, CONTENT_WIDTH) as string[]) {
      y += lineHeight(9);
      doc.text(line, PAGE.width / 2, y - 1, { align: 'center' });
    }
  }
  y += 3;

  // Title bar and the account / period / opening balance rows, as one small table.
  const bar = { fillColor: c.text, textColor: c.surface, fontStyle: 'bold' as const, halign: 'center' as const };
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    styles: { font: FONT, fontSize: 9, cellPadding: 1.6, textColor: c.text, lineColor: c.border, lineWidth: 0.25, fillColor: c.bg },
    body: [
      [{ content: 'Account Ledger', colSpan: 2, styles: bar }],
      [`Account : ${ledger.client.name}`, { content: ledgerPeriod(ledger), styles: { halign: 'right' } }],
      [{ content: `Opening Bal. = Rs. ${balance(ledger.openingBalance)}`, colSpan: 2, styles: { halign: 'right' } }],
    ],
    didParseCell: (data) => {
      // Account name in bold.
      if (data.row.index === 1 && data.column.index === 0) data.cell.styles.fontStyle = 'bold';
    },
  });

  // Entries
  const numeric = { halign: 'right' as const };
  autoTable(doc, {
    startY: finalY(doc) + 2,
    margin: { left: MARGIN, right: MARGIN, top: TOP_CONTINUED, bottom: BOTTOM },
    theme: 'grid',
    styles: { font: FONT, fontSize: 8, cellPadding: 1.5, textColor: c.text, lineColor: c.border, lineWidth: 0.25, valign: 'top' },
    headStyles: { fillColor: c.bg, textColor: c.text, fontStyle: 'bold' },
    footStyles: { fillColor: c.bg, textColor: c.text, fontStyle: 'bold' },
    head: [['Date', 'Type', 'Vch/Bill No', 'Account', 'Debit (Rs.)', 'Credit (Rs.)', 'Balance (Rs.)', 'Short Narration']],
    body: ledger.entries.length
      ? ledger.entries.map((e) => [
          formatDmy(e.date),
          e.type === 'sale' ? 'Sale' : 'Rcpt',
          (e.type === 'sale' ? e.invoiceNumber : e.receiptNumber) ?? '',
          ledgerAccount(e, company),
          e.debit ? money(e.debit) : '',
          e.credit ? money(e.credit) : '',
          balance(e.balance),
          e.reference ?? '',
        ])
      : [[{ content: 'No sales or receipts in this period.', colSpan: 8, styles: { halign: 'center', textColor: c.muted } }]],
    foot: [
      [
        { content: 'Total', colSpan: 4, styles: { halign: 'right' } },
        { content: money(ledger.totals.sales), styles: numeric },
        { content: money(ledger.totals.receipts), styles: numeric },
        { content: '', colSpan: 2 },
      ],
      [{ content: `Closing Bal. = Rs. ${balance(ledger.totals.closingBalance)}`, colSpan: 8, styles: { halign: 'right' } }],
    ],
    showFoot: 'lastPage',
    columnStyles: {
      0: { cellWidth: 21 },
      1: { cellWidth: 12 },
      4: { ...numeric, cellWidth: 22 },
      5: { ...numeric, cellWidth: 22 },
      6: { ...numeric, cellWidth: 25 },
    },
    didParseCell: (data) => {
      // Money headings line up with their numbers.
      if (data.section === 'head' && data.column.index >= 4 && data.column.index <= 6) data.cell.styles.halign = 'right';
    },
  });

  // Running header (from page 2) and footer with page numbers.
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...c.border);
    doc.setLineWidth(0.25);
    if (p > 1) {
      doc.setFont(FONT, 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...c.text);
      doc.text(`Account Ledger · ${ledger.client.name}`, MARGIN, 10);
      doc.setFont(FONT, 'normal');
      doc.setTextColor(...c.muted);
      doc.text(`${ledgerPeriod(ledger)} (continued)`, right, 10, { align: 'right' });
      doc.line(MARGIN, 12.5, right, 12.5);
    }
    const footY = PAGE.height - 10;
    doc.line(MARGIN, footY - 4, right, footY - 4);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...c.muted);
    doc.text(`${company?.name ?? ''} · Account ledger of ${ledger.client.name}`, MARGIN, footY);
    doc.text(`Page ${p} of ${pages}`, right, footY, { align: 'right' });
  }

  return doc.output('blob');
}

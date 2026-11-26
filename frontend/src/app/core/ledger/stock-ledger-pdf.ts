import { Company, StockLedger } from '../data/models';
import { BOTTOM, CONTENT_WIDTH, FONT, MARGIN, PAGE, TOP_CONTINUED, finalY, lineHeight, money, newPdf, themeColors } from '../pdf/pdf-kit';
import { formatDmy } from '../ui/dates';
import { oneLineAddress } from './ledger-labels';

// Builds one product's "Stock Ledger" as an A4 PDF, laid out like the account ledger PDF: business header,
// title bar, product / unit, then opening stock, date-wise purchases (in) and sales (out) with the running
// stock, totals and stock in hand.

const qty = (n: number) => Number(n.toFixed(3)).toLocaleString('en-IN', { maximumFractionDigits: 3 });

export async function createStockLedgerPdf(ledger: StockLedger, company: Company | null): Promise<Blob> {
  const { doc, autoTable } = await newPdf(`Stock Ledger - ${ledger.item.name}`, company?.name ?? '');
  const c = themeColors();
  const right = MARGIN + CONTENT_WIDTH;
  const unit = ledger.item.unit ?? '';
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

  const bar = { fillColor: c.text, textColor: c.surface, fontStyle: 'bold' as const, halign: 'center' as const };
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    styles: { font: FONT, fontSize: 9, cellPadding: 1.6, textColor: c.text, lineColor: c.border, lineWidth: 0.25, fillColor: c.bg },
    body: [
      [{ content: 'Stock Ledger', colSpan: 2, styles: bar }],
      [
        { content: `Product : ${ledger.item.name}`, styles: { fontStyle: 'bold' } },
        { content: [ledger.item.hsnSac && `HSN/SAC ${ledger.item.hsnSac}`, unit && `Unit ${unit}`].filter(Boolean).join(' · '), styles: { halign: 'right' } },
      ],
    ],
  });

  // Opening stock first, then the entries oldest first, so the balance reads downwards.
  const numeric = { halign: 'right' as const };
  autoTable(doc, {
    startY: finalY(doc) + 2,
    margin: { left: MARGIN, right: MARGIN, top: TOP_CONTINUED, bottom: BOTTOM },
    theme: 'grid',
    styles: { font: FONT, fontSize: 8, cellPadding: 1.5, textColor: c.text, lineColor: c.border, lineWidth: 0.25, valign: 'top' },
    headStyles: { fillColor: c.bg, textColor: c.text, fontStyle: 'bold' },
    footStyles: { fillColor: c.bg, textColor: c.text, fontStyle: 'bold' },
    head: [['Date', 'Type', 'Vch/Bill No', 'Party', 'Rate (Rs.)', 'In', 'Out', 'Balance']],
    body: [
      [
        { content: 'Opening stock', colSpan: 5, styles: { fontStyle: 'bold' } },
        { content: ledger.openingStock ? qty(ledger.openingStock) : '', styles: numeric },
        '',
        { content: qty(ledger.openingStock), styles: { ...numeric, fontStyle: 'bold' } },
      ],
      ...ledger.entries.map((e) => [
        formatDmy(e.date),
        e.type === 'purchase' ? 'Purchase' : 'Sale',
        e.number,
        e.party,
        money(e.rate),
        e.quantityIn ? qty(e.quantityIn) : '',
        e.quantityOut ? qty(e.quantityOut) : '',
        qty(e.balance),
      ]),
    ],
    foot: [
      [
        { content: 'Total', colSpan: 5, styles: { halign: 'right' } },
        { content: qty(ledger.totals.purchased), styles: numeric },
        { content: qty(ledger.totals.sold), styles: numeric },
        '',
      ],
      [{ content: `In stock = ${qty(ledger.totals.closingStock)} ${unit}`.trim(), colSpan: 8, styles: { halign: 'right' } }],
    ],
    showFoot: 'lastPage',
    columnStyles: {
      0: { cellWidth: 21 },
      1: { cellWidth: 17 },
      4: { ...numeric, cellWidth: 22 },
      5: { ...numeric, cellWidth: 16 },
      6: { ...numeric, cellWidth: 16 },
      7: { ...numeric, cellWidth: 20 },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index >= 4) data.cell.styles.halign = 'right';
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
      doc.text(`Stock Ledger · ${ledger.item.name}`, MARGIN, 10);
      doc.setFont(FONT, 'normal');
      doc.setTextColor(...c.muted);
      doc.text('(continued)', right, 10, { align: 'right' });
      doc.line(MARGIN, 12.5, right, 12.5);
    }
    const footY = PAGE.height - 10;
    doc.line(MARGIN, footY - 4, right, footY - 4);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...c.muted);
    doc.text(`${company?.name ?? ''} · Stock ledger of ${ledger.item.name}`, MARGIN, footY);
    doc.text(`Page ${p} of ${pages}`, right, footY, { align: 'right' });
  }

  return doc.output('blob');
}

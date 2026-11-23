import { CashBankSummaryRow, Client, Company } from '../data/models';
import { stateLabel } from '../gst/gst-states';
import { BOTTOM, CONTENT_WIDTH, FONT, MARGIN, PAGE, TOP_CONTINUED, finalY, lineHeight, money, newPdf, themeColors } from '../pdf/pdf-kit';
import { formatDmy, todayIso } from '../ui/dates';
import { cashBankAccountLabel } from './cash-bank-labels';
import { oneLineAddress } from './ledger-labels';

// "Ledgers/Party Detail" as an A4 PDF, laid out like the stock ledger PDF: business header, title bar, every party
// with opening, debit, credit and closing balance (Dr = receivable, Cr = payable), receivable / payable totals,
// then cash in hand and the bank accounts.

const TITLE = 'Ledgers/Party Detail';
const balance = (n: number) => (n ? `${money(Math.abs(n))} ${n > 0 ? 'Dr' : 'Cr'}` : money(0));

export async function createPartyListPdf(parties: Client[], cashBank: CashBankSummaryRow[], company: Company | null): Promise<Blob> {
  const { doc, autoTable } = await newPdf(TITLE, company?.name ?? '');
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

  const bar = { fillColor: c.text, textColor: c.surface, fontStyle: 'bold' as const, halign: 'center' as const };
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    styles: { font: FONT, fontSize: 9, cellPadding: 1.6, textColor: c.text, lineColor: c.border, lineWidth: 0.25, fillColor: c.bg },
    body: [
      [{ content: TITLE, colSpan: 2, styles: bar }],
      [
        { content: `Parties : ${parties.length}`, styles: { fontStyle: 'bold' } },
        { content: `As on ${formatDmy(todayIso())}`, styles: { halign: 'right' } },
      ],
    ],
  });

  const numeric = { halign: 'right' as const };
  const table = {
    margin: { left: MARGIN, right: MARGIN, top: TOP_CONTINUED, bottom: BOTTOM },
    theme: 'grid' as const,
    styles: { font: FONT, fontSize: 8, cellPadding: 1.5, textColor: c.text, lineColor: c.border, lineWidth: 0.25, valign: 'top' as const },
    headStyles: { fillColor: c.bg, textColor: c.text, fontStyle: 'bold' as const },
    footStyles: { fillColor: c.bg, textColor: c.text, fontStyle: 'bold' as const },
    showFoot: 'lastPage' as const,
    columnStyles: {
      0: { cellWidth: 'auto' as const },
      3: { ...numeric, cellWidth: 25 },
      4: { ...numeric, cellWidth: 25 },
      5: { ...numeric, cellWidth: 25 },
      6: { ...numeric, cellWidth: 27, fontStyle: 'bold' as const },
    },
    didParseCell: (data: { section: string; column: { index: number }; cell: { styles: { halign: string } } }) => {
      if (data.section === 'head' && data.column.index >= 3) data.cell.styles.halign = 'right';
    },
  };

  let receivable = 0;
  let payable = 0;
  for (const p of parties) {
    if (p.closingBalance > 0) receivable += p.closingBalance;
    else payable -= p.closingBalance;
  }

  autoTable(doc, {
    ...table,
    startY: finalY(doc) + 2,
    head: [['Name', 'GSTIN', 'State / Contact', 'Opening bal.', 'Debit', 'Credit', 'Closing bal.']],
    body: parties.map((p) => [
      [p.name, oneLineAddress(p.address)].filter(Boolean).join('\n'),
      p.gstin ?? '—',
      [stateLabel(p.stateCode), p.phone].filter(Boolean).join('\n'),
      balance(p.openingBalance),
      money(p.debit),
      money(p.credit),
      balance(p.closingBalance),
    ]),
    foot: [
      [
        { content: 'Receivable (Dr)', colSpan: 6, styles: numeric },
        { content: money(receivable), styles: numeric },
      ],
      [
        { content: 'Payable (Cr)', colSpan: 6, styles: numeric },
        { content: money(payable), styles: numeric },
      ],
    ],
  });

  if (cashBank.length) {
    const sum = (key: 'periodOpening' | 'in' | 'out' | 'closing') => cashBank.reduce((t, a) => t + a[key], 0);
    autoTable(doc, {
      ...table,
      startY: finalY(doc) + 5,
      head: [
        [{ content: 'Cash & Bank', colSpan: 7, styles: { ...bar, halign: 'left' } }],
        ['Account', 'IFSC', '', 'Opening bal.', 'In (Dr)', 'Out (Cr)', 'Closing bal.'],
      ],
      body: cashBank.map((a) => [
        cashBankAccountLabel(a),
        company?.bankAccounts.find((b) => b.id === a.bankAccountId)?.ifsc ?? '—',
        a.type === 'cash' ? 'Cash in hand' : 'Bank account',
        balance(a.periodOpening),
        money(a.in),
        money(a.out),
        balance(a.closing),
      ]),
      foot: [
        [
          { content: 'Total cash & bank', colSpan: 3 },
          { content: balance(sum('periodOpening')), styles: numeric },
          { content: money(sum('in')), styles: numeric },
          { content: money(sum('out')), styles: numeric },
          { content: balance(sum('closing')), styles: numeric },
        ],
      ],
    });
  }

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
      doc.text(TITLE, MARGIN, 10);
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
    doc.text(`${company?.name ?? ''} · ${TITLE}`, MARGIN, footY);
    doc.text(`Page ${p} of ${pages}`, right, footY, { align: 'right' });
  }

  return doc.output('blob');
}

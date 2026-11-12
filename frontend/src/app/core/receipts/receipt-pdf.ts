import { Company, Receipt } from '../data/models';
import { amountInWords } from '../gst/amount-in-words';
import { CONTENT_WIDTH, FONT, MARGIN, PAGE, finalY, lineHeight, money, newPdf, themeColors } from '../pdf/pdf-kit';
import { formatDmy, formatTime } from '../ui/dates';
import { oneLineAddress } from '../ledger/ledger-labels';
import { receiptAccountLabel } from './receipt-labels';

// One payment receipt as an A4 PDF, laid out on the top half of the page (so two fit a sheet
// if cut): business header, "RECEIPT" bar, receipt no. / date, who paid how much and how,
// and the signatory. With `autoPrint` the PDF viewer opens the print dialog as soon as it loads.

export async function createReceiptPdf(receipt: Receipt, company: Company | null, autoPrint = true): Promise<Blob> {
  const { doc, autoTable } = await newPdf(`Receipt ${receipt.receiptNumber ?? ''} - ${receipt.clientName}`, company?.name ?? '');
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
  const contact = [
    oneLineAddress(company?.address),
    [company?.phone && `Ph: ${company.phone}`, company?.email, company?.gstin && `GSTIN: ${company.gstin}`].filter(Boolean).join(' · '),
  ].filter(Boolean);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...c.text);
  for (const line of contact.flatMap((text) => doc.splitTextToSize(text, CONTENT_WIDTH) as string[])) {
    y += lineHeight(9);
    doc.text(line, PAGE.width / 2, y - 1, { align: 'center' });
  }
  y += 3;

  const account = receiptAccountLabel(receipt, company);
  const mode = receipt.mode === 'cash' || account === 'Bank' ? account : `Bank (${account})`;
  const label = { fontStyle: 'bold' as const, cellWidth: 45 };
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    styles: { font: FONT, fontSize: 10, cellPadding: 2.2, textColor: c.text, lineColor: c.border, lineWidth: 0.25, valign: 'middle' },
    body: [
      [{ content: 'RECEIPT', colSpan: 4, styles: { fillColor: c.text, textColor: c.surface, fontStyle: 'bold', halign: 'center', fontSize: 11 } }],
      [
        { content: 'Receipt No.', styles: label },
        { content: receipt.receiptNumber ?? '', styles: { fontStyle: 'bold' } },
        { content: 'Date', styles: { fontStyle: 'bold', cellWidth: 20 } },
        { content: [formatDmy(receipt.receiptDate), formatTime(receipt.createdAt)].filter(Boolean).join('\n'), styles: { cellWidth: 30 } },
      ],
      [{ content: 'Received with thanks from', styles: label }, { content: receipt.clientName, colSpan: 3, styles: { fontStyle: 'bold' } }],
      [{ content: 'The sum of', styles: label }, { content: amountInWords(receipt.amount), colSpan: 3 }],
      [{ content: 'By', styles: label }, { content: mode, colSpan: 3 }],
      ...(receipt.reference ? [[{ content: 'Narration', styles: label }, { content: receipt.reference, colSpan: 3 }]] : []),
    ],
  });
  y = finalY(doc) + 6;

  // Amount box (left) and signatory (right).
  const boxWidth = 60;
  const boxHeight = 12;
  doc.setDrawColor(...c.text);
  doc.setLineWidth(0.4);
  doc.rect(MARGIN, y, boxWidth, boxHeight);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...c.text);
  doc.text(`₹ ${money(receipt.amount)}`, MARGIN + boxWidth / 2, y + boxHeight / 2 + 1.6, { align: 'center' });

  const signWidth = 60;
  let sy = y + lineHeight(9.5) - 1;
  doc.setFontSize(9.5);
  if (company?.name) doc.text(`For ${company.name}`, right, sy, { align: 'right', maxWidth: CONTENT_WIDTH - boxWidth - 10 });
  sy += 2;
  let imageHeight = 12;
  if (company?.signature) {
    try {
      const props = doc.getImageProperties(company.signature);
      const scale = Math.min(45 / props.width, 18 / props.height);
      const w = props.width * scale;
      imageHeight = props.height * scale;
      doc.addImage(company.signature, props.fileType, right - w, sy, w, imageHeight);
    } catch {
      // An image jsPDF can't read (e.g. SVG) is left out; the signatory line still prints.
    }
  }
  sy += imageHeight + 2;
  doc.setLineWidth(0.3);
  doc.line(right - signWidth, sy, right, sy);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...c.muted);
  doc.text('Authorised Signatory', right, sy + lineHeight(9), { align: 'right' });

  if (autoPrint) doc.autoPrint();
  return doc.output('blob');
}

import type { jsPDF as JsPdf } from 'jspdf';
import type { CellInput, RowInput, UserOptions } from 'jspdf-autotable';
import { Invoice } from '../data/models';
import { amountInWords } from '../gst/amount-in-words';
import { stateLabel } from '../gst/gst-states';
import {
  BOTTOM,
  CONTENT_WIDTH,
  FONT,
  GAP,
  MARGIN,
  PAGE,
  Rgb,
  TOP_CONTINUED,
  gradientRect,
  lineHeight,
  mix,
  finalY,
  money,
  newPdf,
  themeColors,
} from '../pdf/pdf-kit';
import { formatInvoiceDate, hsnSummary, inclusiveRate } from './invoice-summary';

// Builds the invoice as a real A4 PDF (selectable text, tables drawn with jspdf-autotable), so it
// can be opened on phones where the print dialog is missing. Mirrors <app-invoice-document>,
// including its classic / modern / minimal templates and the current theme colours.

const QTY = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });
const rupees = (n: number) => `₹${money(n)}`;

export async function createInvoicePdf(inv: Invoice): Promise<Blob> {
  const { doc, autoTable } = await newPdf(`Invoice ${inv.invoiceNumber}`, inv.seller.name);
  new InvoicePdfWriter(doc, autoTable, inv).write();
  return doc.output('blob');
}

class InvoicePdfWriter {
  private y = MARGIN;
  private readonly c = themeColors();
  private readonly gst: boolean;
  private readonly showTax: boolean;
  private readonly modern: boolean;
  private readonly minimal: boolean;
  // Accent for headings and table heads: indigo in "modern", plain in the others.
  private readonly accent: Rgb;

  constructor(
    private readonly doc: JsPdf,
    private readonly autoTable: (doc: JsPdf, options: UserOptions) => void,
    private readonly inv: Invoice,
  ) {
    this.gst = !!inv.seller.gstin;
    this.showTax = this.gst && !inv.reverseCharge;
    this.modern = inv.template === 'modern';
    this.minimal = inv.template === 'minimal';
    this.accent = this.modern ? this.c.primaryHover : this.c.muted;
  }

  write(): void {
    this.header();
    this.parties();
    this.lines();
    this.summary();
    this.extras();
    this.signature();
    this.pageFrames();
  }

  // --- Sections ---

  private header(): void {
    const { inv, doc } = this;
    const pad = this.modern ? 5 : 0;
    const titleWidth = 60;
    const sellerWidth = CONTENT_WIDTH - titleWidth - pad * 2;
    const onBand = this.modern;
    const keyColor: Rgb = onBand ? mix(this.c.onPrimary, this.c.surfaceInverse, 0.75) : this.c.muted;
    const textColor: Rgb = onBand ? this.c.onPrimary : this.c.text;

    // Seller lines first, to know the header's height.
    const rows: { key?: string; value: string }[] = [];
    if (inv.seller.address) {
      for (const line of this.wrap(inv.seller.address, sellerWidth, 9)) rows.push({ value: line });
    }
    const contact = [
      inv.seller.phone ? `Mobile: ${inv.seller.phone}` : '',
      inv.seller.email ? `Email: ${inv.seller.email}` : '',
    ].filter(Boolean);
    if (contact.length) rows.push({ value: contact.join('  ·  ') });
    rows.push({ key: 'GSTIN:', value: inv.seller.gstin || 'Not registered' });
    rows.push({ key: 'State:', value: stateLabel(inv.seller.stateCode) });

    const nameLines = this.wrap(inv.seller.name, sellerWidth, 14, 'bold');
    const height = pad * 2 + nameLines.length * lineHeight(14) + 1 + rows.length * lineHeight(9);

    if (this.modern) {
      gradientRect(doc, MARGIN, this.y, CONTENT_WIDTH, height, this.c.surfaceInverse, this.c.primaryHover);
    }

    let y = this.y + pad;
    const x = MARGIN + pad;
    this.font(14, 'bold', textColor);
    for (const line of nameLines) {
      y += lineHeight(14);
      doc.text(line, x, y - 1.2);
    }
    y += 1;
    for (const row of rows) {
      y += lineHeight(9);
      this.font(9, 'normal', row.key ? keyColor : textColor);
      if (row.key) {
        doc.text(row.key, x, y - 1);
        this.font(9, 'normal', textColor);
        doc.text(row.value, x + doc.getTextWidth(row.key) + 1.2, y - 1);
      } else {
        doc.text(row.value, x, y - 1);
      }
    }

    const right = MARGIN + CONTENT_WIDTH - pad;
    const titleColor: Rgb = onBand ? this.c.onPrimary : this.minimal ? this.c.text : this.c.primary;
    this.font(17, 'bold', titleColor);
    doc.text(this.gst ? 'TAX INVOICE' : 'INVOICE', right, this.y + pad + lineHeight(17) - 1.5, { align: 'right' });
    this.font(9.5, 'normal', keyColor);
    doc.text(inv.invoiceNumber, right, this.y + pad + lineHeight(17) + lineHeight(9.5) - 1, { align: 'right' });

    this.y += height;
    if (!this.modern) {
      this.y += 3;
      doc.setDrawColor(...(this.minimal ? this.c.text : this.c.border));
      doc.setLineWidth(0.6);
      doc.line(MARGIN, this.y, MARGIN + CONTENT_WIDTH, this.y);
    }
    this.y += GAP;
  }

  private parties(): void {
    const { inv, doc } = this;
    const boxWidth = (CONTENT_WIDTH - 4) / 2;
    const pad = 4;
    const inner = boxWidth - pad * 2;

    const billed: { key?: string; value: string; bold?: boolean }[] = [];
    for (const line of this.wrap(inv.client.name, inner, 10, 'bold')) billed.push({ value: line, bold: true });
    if (inv.client.address) {
      for (const line of this.wrap(inv.client.address, inner, 9)) billed.push({ value: line });
    }
    billed.push({ key: 'GSTIN:', value: inv.client.gstin || 'Not registered' });
    billed.push({ key: 'State:', value: stateLabel(inv.client.stateCode) });

    const meta: [string, string][] = [
      ['Invoice no.', inv.invoiceNumber],
      ['Invoice date', formatInvoiceDate(inv.invoiceDate)],
      ['Due date', formatInvoiceDate(inv.dueDate)],
      ['Place of supply', stateLabel(inv.placeOfSupplyCode)],
      ['Reverse charge', inv.reverseCharge ? 'Yes' : 'No'],
    ];

    const leftHeight = lineHeight(8) + 1 + billed.length * lineHeight(9.5);
    const rightHeight = meta.length * lineHeight(9.5) * 1.15;
    const height = Math.max(leftHeight, rightHeight) + pad * 2;
    this.ensureSpace(height);

    const radius = this.minimal ? 0 : 2;
    doc.setDrawColor(...this.c.border);
    doc.setLineWidth(0.25);
    doc.roundedRect(MARGIN, this.y, boxWidth, height, radius, radius, 'S');
    const rightX = MARGIN + boxWidth + 4;
    doc.roundedRect(rightX, this.y, boxWidth, height, radius, radius, 'S');

    // Billed to
    let y = this.y + pad + lineHeight(8) - 1;
    this.heading('BILLED TO', MARGIN + pad, y);
    y += 1;
    for (const row of billed) {
      y += lineHeight(9.5);
      if (row.key) {
        this.font(9, 'normal', this.c.muted);
        doc.text(row.key, MARGIN + pad, y - 1);
        this.font(9, 'normal', this.c.text);
        doc.text(row.value, MARGIN + pad + doc.getTextWidth(row.key) + 1.2, y - 1);
      } else {
        this.font(row.bold ? 10 : 9, row.bold ? 'bold' : 'normal', this.c.text);
        doc.text(row.value, MARGIN + pad, y - 1);
      }
    }

    // Invoice details
    y = this.y + pad;
    for (const [key, value] of meta) {
      y += lineHeight(9.5) * 1.15;
      this.font(9, 'normal', this.c.muted);
      doc.text(key, rightX + pad, y - 1.2);
      this.font(9, 'bold', this.c.text);
      doc.text(value, rightX + boxWidth - pad, y - 1.2, { align: 'right' });
    }

    this.y += height + GAP;
  }

  private lines(): void {
    const { inv } = this;
    const head: string[] = ['#', 'Particulars', 'HSN/SAC', 'Qty', 'Unit', 'Rate (₹)'];
    if (this.showTax) head.push('GST %', 'Taxable (₹)', 'Tax (₹)', 'Total (₹)');
    else head.push(this.gst ? 'Taxable (₹)' : 'Amount (₹)');

    const body: RowInput[] = inv.lines.map((line, i) => {
      const particulars = line.narration ? `${line.description}\n${line.narration}` : line.description;
      const row: CellInput[] = [String(i + 1), particulars, line.hsnSac || '—', QTY.format(line.quantity), line.unit || '—'];
      if (this.showTax) {
        row.push(money(line.unitPrice), `${line.gstRate}%`, money(line.taxableAmount), money(line.totalTax), money(line.lineTotal));
      } else if (this.gst) {
        row.push(money(line.unitPrice), money(line.taxableAmount));
      } else {
        row.push(money(inclusiveRate(line)), money(line.lineTotal));
      }
      return row;
    });

    const total: CellInput[] = this.showTax
      ? [{ content: 'Total', colSpan: 7 }, money(inv.totals.subTotal), money(inv.totals.totalTax), money(inv.totals.grandTotal)]
      : [{ content: 'Total', colSpan: 6 }, money(inv.totals.grandTotal)];

    // Right-align numbers: Qty and every column from Rate on.
    const numeric: Record<number, { halign: 'right' }> = { 3: { halign: 'right' } };
    for (let i = 5; i < head.length; i++) numeric[i] = { halign: 'right' };

    this.table({
      head: [head],
      body,
      foot: [total],
      showFoot: 'lastPage',
      columnStyles: { 0: { cellWidth: 7 }, 1: { cellWidth: 'auto' }, ...numeric },
      styles: { fontSize: this.showTax ? 7.5 : 8.5 },
    });
    this.y = this.finalY() + GAP;
  }

  private summary(): void {
    const { inv, doc } = this;
    const totalsWidth = 70;
    const leftWidth = CONTENT_WIDTH - totalsWidth - GAP;
    const totalsX = MARGIN + leftWidth + GAP;

    // Totals box (right)
    const totals: [string, string][] = [];
    if (this.showTax) {
      totals.push(['Sub-total', rupees(inv.totals.subTotal)]);
      if (inv.isInterState) {
        totals.push(['Add IGST', rupees(inv.totals.totalIgst)]);
      } else {
        totals.push(['Add CGST', rupees(inv.totals.totalCgst)]);
        totals.push(['Add SGST', rupees(inv.totals.totalSgst)]);
      }
    }
    const grandLabel = this.showTax ? 'Grand total' : this.gst ? 'Taxable amount' : 'Total';

    // Keep the totals and the amount in words together on one page.
    this.ensureSpace(totals.length * 6 + 18);
    const startY = this.y;
    const startPage = this.page();

    this.autoTable(doc, {
      startY,
      margin: { left: totalsX, right: MARGIN, top: TOP_CONTINUED, bottom: BOTTOM },
      tableWidth: totalsWidth,
      theme: 'plain',
      body: [
        ...totals.map(([k, v]) => [k, v]),
        [
          { content: grandLabel, styles: { fontStyle: 'bold', fontSize: 11, textColor: this.modern ? this.c.primaryHover : this.c.text } },
          { content: rupees(inv.totals.grandTotal), styles: { fontStyle: 'bold', fontSize: 11, textColor: this.modern ? this.c.primaryHover : this.c.text } },
        ],
      ],
      styles: { font: FONT, fontSize: 9, cellPadding: { top: 1.4, bottom: 1.4, left: 3, right: 3 }, textColor: this.c.muted },
      columnStyles: { 1: { halign: 'right', textColor: this.c.text, fontStyle: 'bold' } },
      tableLineColor: this.c.border,
      tableLineWidth: 0.25,
      didDrawCell: (data) => {
        // Rule above the grand total when there are rows above it.
        if (totals.length && data.row.index === totals.length && data.column.index === 0) {
          doc.setDrawColor(...this.c.border);
          doc.setLineWidth(0.25);
          doc.line(totalsX, data.cell.y, totalsX + totalsWidth, data.cell.y);
        }
      },
    });
    const totalsEnd = this.finalY();

    // Amount in words, reverse-charge note and HSN summary (left)
    let y = startY;
    const words = this.wrap(`Amount in words: ${amountInWords(inv.totals.grandTotal)}`, leftWidth, 9);
    this.font(9, 'normal', this.c.text);
    for (const line of words) {
      y += lineHeight(9);
      doc.text(line, MARGIN, y - 1);
    }
    if (this.gst && inv.reverseCharge) {
      y += 1.5;
      for (const line of this.wrap('Tax is payable by the recipient on reverse charge basis. No GST is charged on this invoice.', leftWidth, 9)) {
        y += lineHeight(9);
        doc.text(line, MARGIN, y - 1);
      }
    }
    y += 3;

    if (this.showTax) {
      this.heading('HSN/SAC SUMMARY', MARGIN, y + lineHeight(8) - 1);
      y += lineHeight(8) + 1;
      const taxHead = inv.isInterState ? ['IGST'] : ['CGST', 'SGST'];
      const rows = hsnSummary(inv.lines).map((r) => [
        r.hsnSac,
        `${r.gstRate}%`,
        money(r.taxable),
        ...(inv.isInterState ? [money(r.igst)] : [money(r.cgst), money(r.sgst)]),
        money(r.tax),
      ]);
      const numeric: Record<number, { halign: 'right' }> = {};
      for (let i = 1; i < 4 + taxHead.length; i++) numeric[i] = { halign: 'right' };
      this.table({
        startY: y,
        margin: { left: MARGIN, right: MARGIN + totalsWidth + GAP, top: TOP_CONTINUED, bottom: BOTTOM },
        tableWidth: leftWidth,
        head: [['HSN/SAC', 'Rate', 'Taxable', ...taxHead, 'Total tax']],
        body: rows,
        styles: { fontSize: 7.5 },
        columnStyles: numeric,
      });
      // The HSN table may run onto a new page; the totals box stays on the first one.
      y = this.page() === startPage ? Math.max(this.finalY(), totalsEnd) : this.finalY();
    } else {
      y = Math.max(y, totalsEnd);
    }

    this.y = y + GAP;
  }

  private extras(): void {
    const { inv, doc } = this;
    const bank = inv.seller.bankName || inv.seller.accountNo || inv.seller.ifsc;
    const terms = inv.seller.terms?.trim();
    const colWidth = terms ? (CONTENT_WIDTH - GAP) / 2 : CONTENT_WIDTH;

    const bankLines: { key?: string; value: string }[] = bank
      ? [
          { key: 'Bank:', value: inv.seller.bankName || '—' },
          { key: 'A/C no.:', value: inv.seller.accountNo || '—' },
          { key: 'IFSC:', value: inv.seller.ifsc || '—' },
        ]
      : [{ value: 'Not provided.' }];
    const termLines = terms ? this.wrap(terms, colWidth, 8.5) : [];
    const height = 4 + lineHeight(8) + Math.max(bankLines.length * lineHeight(9), termLines.length * lineHeight(8.5));

    // Long terms may still run past one page; they are split line by line below.
    this.ensureSpace(Math.min(height, 40));
    doc.setDrawColor(...this.c.border);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, this.y, MARGIN + CONTENT_WIDTH, this.y);
    const top = this.y + 4;

    let y = top + lineHeight(8) - 1;
    this.heading('BANK DETAILS', MARGIN, y);
    y += 1;
    for (const row of bankLines) {
      y += lineHeight(9);
      if (row.key) {
        this.font(9, 'normal', this.c.muted);
        doc.text(row.key, MARGIN, y - 1);
        this.font(9, 'normal', this.c.text);
        doc.text(row.value, MARGIN + doc.getTextWidth(row.key) + 1.2, y - 1);
      } else {
        this.font(9, 'normal', this.c.muted);
        doc.text(row.value, MARGIN, y - 1);
      }
    }
    let end = y;

    if (terms) {
      const x = MARGIN + colWidth + GAP;
      let ty = top + lineHeight(8) - 1;
      this.heading('TERMS & CONDITIONS', x, ty);
      ty += 1;
      this.font(8.5, 'normal', this.c.text);
      for (const line of termLines) {
        if (ty + lineHeight(8.5) > PAGE.height - BOTTOM) {
          doc.addPage();
          ty = TOP_CONTINUED;
          end = 0;
          this.font(8.5, 'normal', this.c.text);
        }
        ty += lineHeight(8.5);
        doc.text(line, x, ty - 1);
      }
      end = Math.max(end, ty);
    }

    this.y = end + GAP * 2;
  }

  private signature(): void {
    const { inv, doc } = this;
    const right = MARGIN + CONTENT_WIDTH;
    const width = 60;
    const image = inv.seller.signature ? this.signatureImage(inv.seller.signature) : null;
    const imageHeight = image ? image.height : 12;
    this.ensureSpace(lineHeight(9.5) + imageHeight + 12);

    let y = this.y + lineHeight(9.5) - 1;
    this.font(9.5, 'bold', this.c.text);
    doc.text(`For ${inv.seller.name}`, right, y, { align: 'right', maxWidth: CONTENT_WIDTH });
    y += 2;
    if (image) {
      try {
        doc.addImage(inv.seller.signature!, image.format, right - image.width, y, image.width, image.height);
      } catch {
        // An image jsPDF can't read (e.g. SVG) is left out; the signatory line still prints.
      }
    }
    y += imageHeight + 2;
    doc.setDrawColor(...this.c.text);
    doc.setLineWidth(0.3);
    doc.line(right - width, y, right, y);
    this.font(9, 'normal', this.c.muted);
    doc.text('Authorised Signatory', right, y + lineHeight(9), { align: 'right' });
  }

  // Running header (from page 2) and footer with page numbers, on every page.
  private pageFrames(): void {
    const { inv, doc } = this;
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      if (p > 1) {
        this.font(8, 'bold', this.c.text);
        doc.text(inv.seller.name, MARGIN, 10);
        this.font(8, 'normal', this.c.muted);
        doc.text(`${this.gst ? 'Tax invoice' : 'Invoice'} ${inv.invoiceNumber} (continued)`, MARGIN + CONTENT_WIDTH, 10, { align: 'right' });
        doc.setDrawColor(...this.c.border);
        doc.setLineWidth(0.25);
        doc.line(MARGIN, 12.5, MARGIN + CONTENT_WIDTH, 12.5);
      }
      const footY = PAGE.height - 10;
      doc.setDrawColor(...this.c.border);
      doc.setLineWidth(0.25);
      doc.line(MARGIN, footY - 4, MARGIN + CONTENT_WIDTH, footY - 4);
      this.font(7, 'normal', this.c.muted);
      doc.text(`${inv.seller.name} · Invoice ${inv.invoiceNumber} · ${formatInvoiceDate(inv.invoiceDate)}`, MARGIN, footY);
      doc.text(`This is a computer-generated invoice.  Page ${p} of ${pages}`, MARGIN + CONTENT_WIDTH, footY, { align: 'right' });
    }
  }

  // --- Helpers ---

  // Shared look for the line-item and HSN tables, per template.
  private table(options: UserOptions): void {
    const headFill: Rgb = this.modern ? this.c.primarySoft : this.minimal ? this.c.surface : this.c.bg;
    const headText: Rgb = this.modern ? this.c.primaryHover : this.c.text;
    this.autoTable(this.doc, {
      startY: this.y,
      margin: { left: MARGIN, right: MARGIN, top: TOP_CONTINUED, bottom: BOTTOM },
      theme: 'grid',
      ...options,
      styles: {
        font: FONT,
        fontSize: 8.5,
        cellPadding: 1.8,
        textColor: this.c.text,
        lineColor: this.c.border,
        lineWidth: 0.25,
        valign: 'middle',
        ...options.styles,
      },
      headStyles: { fillColor: headFill, textColor: headText, fontStyle: 'bold' },
      footStyles: { fillColor: headFill, textColor: headText, fontStyle: 'bold' },
      // Headings and totals line up with their column (numbers right-aligned).
      didParseCell: (data) => {
        if (data.section === 'body') return;
        const align = options.columnStyles?.[data.column.index]?.halign;
        const spansFirst = data.section === 'foot' && data.column.index === 0;
        if (align && !spansFirst) data.cell.styles.halign = align;
      },
    });
  }

  private heading(text: string, x: number, y: number): void {
    this.font(8, 'bold', this.accent);
    this.doc.text(text, x, y, { charSpace: 0.3 });
  }

  private font(size: number, style: 'normal' | 'bold', color: Rgb): void {
    this.doc.setFont(FONT, style);
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
  }

  private wrap(text: string, width: number, size: number, style: 'normal' | 'bold' = 'normal'): string[] {
    this.doc.setFont(FONT, style);
    this.doc.setFontSize(size);
    return this.doc.splitTextToSize(text, width) as string[];
  }

  private ensureSpace(height: number): void {
    if (this.y + height > PAGE.height - BOTTOM) {
      this.doc.addPage();
      this.y = TOP_CONTINUED;
    }
  }

  private finalY(): number {
    return finalY(this.doc);
  }

  private page(): number {
    return this.doc.getCurrentPageInfo().pageNumber;
  }

  // Fits the signature in 45 × 18 mm, keeping its shape.
  private signatureImage(src: string): { width: number; height: number; format: string } | null {
    try {
      const props = this.doc.getImageProperties(src);
      const scale = Math.min(45 / props.width, 18 / props.height);
      return { width: props.width * scale, height: props.height * scale, format: props.fileType };
    } catch {
      return null;
    }
  }
}

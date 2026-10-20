import { calculateInvoice, calculateLine } from './gst';

describe('calculateLine', () => {
  it('splits intra-state GST into equal CGST and SGST', () => {
    expect(calculateLine({ quantity: 1, unitPrice: 50000, gstRate: 18 }, false)).toEqual({
      taxableAmount: 50000,
      cgst: 4500,
      sgst: 4500,
      igst: 0,
      totalTax: 9000,
      lineTotal: 59000,
    });
  });

  it('charges IGST for inter-state supply', () => {
    const line = calculateLine({ quantity: 2, unitPrice: 500, gstRate: 18 }, true);
    expect(line.igst).toBe(180);
    expect(line.cgst + line.sgst).toBe(0);
  });

  it('keeps CGST + SGST equal to the tax when halving leaves an odd paisa', () => {
    // 1.05 × 5% = 0.0525 → tax 0.05; halves 0.03 + 0.02
    const line = calculateLine({ quantity: 1, unitPrice: 1.05, gstRate: 5 }, false);
    expect(line.totalTax).toBe(0.05);
    expect(Math.round((line.cgst + line.sgst) * 100) / 100).toBe(0.05);
  });
});

describe('calculateInvoice', () => {
  const lines = [
    { quantity: 1, unitPrice: 50000, gstRate: 18 },
    { quantity: 2, unitPrice: 500, gstRate: 18 },
  ];

  it('totals an intra-state invoice', () => {
    const { isInterState, totals } = calculateInvoice(lines, '03', '03');
    expect(isInterState).toBe(false);
    expect(totals).toEqual({ subTotal: 51000, totalCgst: 4590, totalSgst: 4590, totalIgst: 0, totalTax: 9180, grandTotal: 60180 });
  });

  it('uses IGST when place of supply differs from the seller state', () => {
    const { isInterState, totals } = calculateInvoice(lines, '03', '07');
    expect(isInterState).toBe(true);
    expect(totals.totalIgst).toBe(9180);
    expect(totals.grandTotal).toBe(60180);
  });
});

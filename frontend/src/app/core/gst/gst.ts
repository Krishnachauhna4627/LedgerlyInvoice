// Live-preview copy of backend/src/lib/gst.js. The server recalculates on save; keep the two in step.

export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export interface LineInput {
  quantity: number;
  unitPrice: number;
  gstRate: number;
}

export interface LineAmounts {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  lineTotal: number;
}

export interface InvoiceTotals {
  subTotal: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  grandTotal: number;
}

// Under reverse charge no GST is added: the taxable amount is the final amount.
export function calculateLine(line: LineInput, isInterState: boolean, reverseCharge = false): LineAmounts {
  const taxableAmount = round2((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0));
  const totalTax = reverseCharge ? 0 : round2((taxableAmount * (Number(line.gstRate) || 0)) / 100);
  const cgst = isInterState ? 0 : round2(totalTax / 2);
  const sgst = isInterState ? 0 : round2(totalTax - cgst);
  const igst = isInterState ? totalTax : 0;
  return { taxableAmount, cgst, sgst, igst, totalTax, lineTotal: round2(taxableAmount + totalTax) };
}

export function calculateInvoice(
  lines: LineInput[],
  sellerStateCode: string | null,
  placeOfSupplyCode: string | null,
  reverseCharge = false,
): { isInterState: boolean; lines: LineAmounts[]; totals: InvoiceTotals } {
  // Without both codes we can't tell; treat as intra-state like the server does when they match.
  const isInterState = !!sellerStateCode && !!placeOfSupplyCode && sellerStateCode !== placeOfSupplyCode;
  const amounts = lines.map((line) => calculateLine(line, isInterState, reverseCharge));
  const sum = (key: keyof LineAmounts) => round2(amounts.reduce((total, a) => total + a[key], 0));
  const subTotal = sum('taxableAmount');
  const totalTax = sum('totalTax');
  return {
    isInterState,
    lines: amounts,
    totals: {
      subTotal,
      totalCgst: sum('cgst'),
      totalSgst: sum('sgst'),
      totalIgst: sum('igst'),
      totalTax,
      grandTotal: round2(subTotal + totalTax),
    },
  };
}

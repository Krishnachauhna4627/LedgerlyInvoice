// GST rules shared by invoices and reports. The frontend mirrors these in core/gst/ for live previews,
// but the server's numbers are the ones that get saved.

// GST state codes ('25' and '28' are retired and intentionally missing).
export const GST_STATE_CODES = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18',
  '19', '20', '21', '22', '23', '24', '26', '27', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38',
  '97', '99',
];

export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

// Tax for one line. Intra-state GST is split into CGST + SGST; SGST takes the remainder so the
// two halves always add up to the line's tax exactly. Under reverse charge no GST is added:
// the taxable amount is the final amount.
export function calculateLine({ quantity, unitPrice, gstRate }, isInterState, reverseCharge = false) {
  const taxableAmount = round2(quantity * unitPrice);
  const totalTax = reverseCharge ? 0 : round2((taxableAmount * gstRate) / 100);
  const cgst = isInterState ? 0 : round2(totalTax / 2);
  const sgst = isInterState ? 0 : round2(totalTax - cgst);
  const igst = isInterState ? totalTax : 0;
  return { taxableAmount, cgst, sgst, igst, totalTax, lineTotal: round2(taxableAmount + totalTax) };
}

export function calculateInvoice(lines, sellerStateCode, placeOfSupplyCode, reverseCharge = false) {
  const isInterState = placeOfSupplyCode !== sellerStateCode;
  const calculated = lines.map((line) => ({ ...line, ...calculateLine(line, isInterState, reverseCharge) }));
  const sum = (key) => round2(calculated.reduce((total, line) => total + line[key], 0));
  const totals = {
    subTotal: sum('taxableAmount'),
    totalCgst: sum('cgst'),
    totalSgst: sum('sgst'),
    totalIgst: sum('igst'),
    totalTax: sum('totalTax'),
  };
  return { isInterState, lines: calculated, totals: { ...totals, grandTotal: round2(totals.subTotal + totals.totalTax) } };
}

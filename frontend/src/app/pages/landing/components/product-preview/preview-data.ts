// Sample invoice shown in the landing page mockup.
export interface PreviewLineItem {
  name: string;
  hsn: string;
  qty: number;
  rate: number;
  gstRate: number;
}

export const PREVIEW_ITEMS: PreviewLineItem[] = [
  { name: 'Laptop', hsn: '8471', qty: 1, rate: 50000, gstRate: 18 },
  { name: 'Mouse', hsn: '8471', qty: 2, rate: 500, gstRate: 18 },
];

const subtotal = PREVIEW_ITEMS.reduce((sum, item) => sum + item.qty * item.rate, 0);
const gst = PREVIEW_ITEMS.reduce((sum, item) => sum + (item.qty * item.rate * item.gstRate) / 100, 0);

// Intra-state sale, so GST is split equally into CGST and SGST.
export const PREVIEW_TOTALS = {
  subtotal,
  cgst: gst / 2,
  sgst: gst / 2,
  total: subtotal + gst,
};

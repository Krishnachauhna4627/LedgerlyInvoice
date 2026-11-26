// Shapes returned by the backend API.

export interface Company {
  id: number;
  name: string;
  address: string | null;
  stateCode: string | null;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  // Primary bank account (the first of bankAccounts), printed on invoices.
  bankName: string | null;
  accountNo: string | null;
  ifsc: string | null;
  terms: string | null;
  // Cash in hand before using the app: where the cash book starts.
  cashOpeningBalance: number;
  // Data URL of the uploaded signature image; saved separately from the other details.
  signature: string | null;
  // Every bank account of the business, primary first.
  bankAccounts: BankAccount[];
}

export interface BankAccount {
  id: number;
  bankName: string | null;
  accountNo: string | null;
  ifsc: string | null;
  // Money in the account before using the app: where its bank book starts (negative = overdrawn).
  openingBalance: number;
}

// id of an existing account (so receipts stay linked to it), null for a new one.
export type BankAccountInput = Omit<BankAccount, 'id'> & { id: number | null };

// The bank account shown on a receipt / ledger entry.
export type BankAccountRef = Pick<BankAccount, 'bankName' | 'accountNo'>;

// The primary bank details are taken from the first entry of bankAccounts.
export type CompanyInput = Omit<Company, 'id' | 'signature' | 'bankName' | 'accountNo' | 'ifsc' | 'bankAccounts'> & {
  bankAccounts: BankAccountInput[];
};

export interface Client {
  id: number;
  name: string;
  address: string | null;
  stateCode: string;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  // Owed before using the app: positive = due (Dr), negative = advance (Cr).
  openingBalance: number;
  // Opening balance + sales − receipts (calculated by the server); same sign rule. Customer side only.
  balance: number;
  // The whole party, sales and purchases (calculated by the server):
  // debit = sales invoices + payments made to them; credit = receipts from them + purchases from them.
  debit: number;
  credit: number;
  // Opening balance + debit − credit: positive = Dr (receivable), negative = Cr (payable).
  closingBalance: number;
}

export type ClientInput = Omit<Client, 'id' | 'balance' | 'debit' | 'credit' | 'closingBalance'>;

export type ReceiptMode = 'cash' | 'bank';

export interface Receipt {
  id: number;
  clientId: number;
  clientName: string;
  // Receipt No., unique per company, like the invoice number.
  receiptNumber: string;
  receiptDate: string;
  // When it was saved (ISO timestamp, UTC); the date has no time. Not shown: bills, reports and ledgers show dates only.
  createdAt?: string | null;
  mode: ReceiptMode;
  // The business bank account the money went into (bank receipts only; null if not chosen or since removed).
  bankAccountId: number | null;
  bankAccount: BankAccountRef | null;
  amount: number;
  // Short narration: cheque no., UPI ref, "part payment"…
  reference: string | null;
}

export type ReceiptInput = Omit<Receipt, 'id' | 'clientName' | 'bankAccount'>;

// A purchase bill from a vendor, with the items bought (the "Purchases" page).
export interface PurchaseLine {
  itemId: number | null;
  description: string;
  narration: string | null;
  hsnSac: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  gstRate: number;
  // Calculated by the server; GST is CGST + SGST from a vendor in our state, IGST from another state.
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  lineTotal: number;
}

export interface Purchase {
  id: number;
  // Purchase No., unique per company.
  purchaseNumber: string;
  // The vendor, a saved party (customer list). Null on bills recorded before vendors were picked, or if it was deleted.
  clientId: number | null;
  // Copied from the party when the bill was saved.
  vendorName: string;
  vendorGstin: string | null;
  vendorStateCode: string | null;
  purchaseDate: string;
  // When it was saved (ISO timestamp, UTC); the date has no time. Not shown: bills, reports and ledgers show dates only.
  createdAt?: string | null;
  // Optional — vendor's bill no., etc.
  note: string | null;
  lines: PurchaseLine[];
  totals: { subTotal: number; totalCgst: number; totalSgst: number; totalIgst: number; totalTax: number; grandTotal: number };
}

export type PurchaseInput = Pick<Purchase, 'purchaseNumber' | 'purchaseDate' | 'note'> & {
  clientId: number;
  lines: Omit<PurchaseLine, 'taxableAmount' | 'cgst' | 'sgst' | 'igst' | 'totalTax' | 'lineTotal'>[];
};

// Money paid to a vendor (the "Payments" page): payment details only, like a receipt.
export interface VendorPayment {
  id: number;
  // Payment No., unique per company.
  paymentNumber: string;
  // The vendor, a saved party. Null on payments recorded before vendors were picked, or if it was deleted.
  clientId: number | null;
  // Copied from the party when the payment was saved.
  vendorName: string;
  paymentDate: string;
  // When it was saved (ISO timestamp, UTC); the date has no time. Not shown: bills, reports and ledgers show dates only.
  createdAt?: string | null;
  mode: ReceiptMode;
  // The business bank account it was paid from (bank payments only).
  bankAccountId: number | null;
  bankAccount: BankAccountRef | null;
  amount: number;
  // Short narration: cheque no., UPI ref, bill no.…
  reference: string | null;
}

export type VendorPaymentInput = Omit<VendorPayment, 'id' | 'createdAt' | 'bankAccount' | 'clientId' | 'vendorName'> & { clientId: number };

export interface LedgerEntry {
  // Debit: sale, payment (we paid them). Credit: receipt (they paid us), purchase (their bill to us).
  type: 'sale' | 'receipt' | 'purchase' | 'payment';
  // Id of the invoice / receipt / purchase / payment.
  id: number;
  date: string;
  // When it was saved (ISO timestamp, UTC); the date has no time. Not shown: bills, reports and ledgers show dates only.
  createdAt?: string | null;
  // Voucher / bill number of any entry (invoiceNumber / receiptNumber are only set on sales / receipts).
  number: string | null;
  invoiceNumber: string | null;
  receiptNumber: string | null;
  // Receipts and payments: cash or bank.
  mode: ReceiptMode | null;
  bankAccount: BankAccountRef | null;
  reference: string | null;
  debit: number;
  credit: number;
  // Running balance after this entry: positive = Dr (due), negative = Cr (advance).
  balance: number;
}

export interface Ledger {
  client: Client;
  from: string | null;
  to: string | null;
  // Balance carried in from before `from` (includes the customer's opening balance).
  openingBalance: number;
  entries: LedgerEntry[];
  totals: {
    sales: number;
    receipts: number;
    purchases: number;
    payments: number;
    // All entries: sales + payments, receipts + purchases.
    debit: number;
    credit: number;
    closingBalance: number;
  };
}

export interface Item {
  id: number;
  name: string;
  hsnSac: string | null;
  unit: string | null;
  unitPrice: number;
  gstRate: number;
  // Quantity in hand when starting out, in the item's unit.
  openingStock: number;
  // Only on the products list (GET /api/items): quantity purchased, sold on issued invoices, and
  // opening + in − out — the same figures as the item's stock ledger.
  stockIn?: number;
  stockOut?: number;
  closingStock?: number;
}

export type ItemInput = Omit<Item, 'id' | 'stockIn' | 'stockOut' | 'closingStock'>;

// Stock ledger of one product: purchases add stock, sales on issued invoices take it away.
export interface StockLedgerEntry {
  type: 'purchase' | 'sale';
  // Purchase payment id for a purchase, invoice id for a sale.
  id: number;
  date: string;
  // When it was saved (ISO timestamp, UTC); the date has no time. Not shown: bills, reports and ledgers show dates only.
  createdAt?: string | null;
  // Payment No. or invoice number.
  number: string;
  // Vendor or customer.
  party: string;
  unit: string | null;
  rate: number;
  quantityIn: number;
  quantityOut: number;
  // Stock after this entry.
  balance: number;
}

export interface StockLedger {
  item: Item;
  openingStock: number;
  entries: StockLedgerEntry[];
  totals: { purchased: number; sold: number; closingStock: number };
}

export type InvoiceStatus = 'draft' | 'unpaid' | 'paid';
// What the UI shows: "overdue" = unpaid and past its due date (computed by the server).
export type DisplayStatus = InvoiceStatus | 'overdue';
export type InvoiceTemplate = 'classic' | 'modern' | 'minimal';
export type InvoiceSort =
  | 'date_desc'
  | 'date_asc'
  | 'amount_desc'
  | 'amount_asc'
  | 'number_asc'
  | 'number_desc'
  | 'status';

export interface InvoiceListItem {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  // When it was saved (ISO timestamp, UTC); the date has no time. Not shown: bills, reports and ledgers show dates only.
  createdAt?: string | null;
  dueDate: string | null;
  status: InvoiceStatus;
  displayStatus: DisplayStatus;
  clientId: number | null;
  clientName: string;
  clientGstin: string | null;
  placeOfSupplyCode: string | null;
  itemCount: number;
  subTotal: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  grandTotal: number;
  // Still to be received: 0 when paid; less than the total when receipts part-paid it (oldest invoices first).
  amountDue: number;
  // Only on GET /api/invoices (the invoices list), not on the dashboard's recent invoices.
  lines?: InvoiceListLine[];
}

// One line of an invoice as shown in the invoices list.
export interface InvoiceListLine {
  description: string;
  hsnSac: string | null;
  quantity: number;
  unit: string | null;
  gstRate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  lineTotal: number;
}

export interface InvoiceLine {
  id?: number;
  itemId: number | null;
  description: string;
  narration: string | null;
  hsnSac: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  gstRate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  lineTotal: number;
}

export interface Invoice extends InvoiceListItem {
  paidAt: string | null;
  template: InvoiceTemplate;
  reverseCharge: boolean;
  placeOfSupplyCode: string;
  // Optional vehicle no. / transporter; printed on the invoice when set.
  transportDetails: string | null;
  isInterState: boolean;
  seller: Omit<Company, 'id' | 'bankAccounts'>;
  client: { name: string; address: string | null; stateCode: string; gstin: string | null };
  totals: {
    subTotal: number;
    totalCgst: number;
    totalSgst: number;
    totalIgst: number;
    totalTax: number;
    grandTotal: number;
  };
  lines: InvoiceLine[];
}

// What the editor sends; the server computes every amount itself.
export interface InvoiceInput {
  clientId: number | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  placeOfSupplyCode: string | null;
  transportDetails: string | null;
  reverseCharge: boolean;
  template: InvoiceTemplate;
  status: InvoiceStatus;
  lines: {
    itemId: number | null;
    description: string;
    narration: string | null;
    hsnSac: string | null;
    quantity: number;
    unit: string | null;
    unitPrice: number;
    gstRate: number;
  }[];
}

export interface InvoiceQuery {
  search?: string;
  from?: string;
  to?: string;
  status?: DisplayStatus;
  sort?: InvoiceSort;
  limit?: number;
}

// 'custom' = the dates the user picked (from / to).
export type DashboardPeriod = 'this_month' | 'last_month' | 'this_quarter' | 'last_6_months' | 'this_year' | 'custom';

// A dashboard figure for the period, with the same figure for the previous period (for the % change).
export interface DashboardStat {
  amount: number;
  count: number;
  previous: number;
}

export interface DashboardTrendMonth {
  month: string; // 'YYYY-MM'
  sales: number;
  purchases: number;
  received: number;
  paid: number;
  // Balances at the month's end.
  receivable: number;
  payable: number;
}

export interface DashboardSummary {
  period: { key: DashboardPeriod; from: string; to: string };
  sales: DashboardStat;
  purchases: DashboardStat;
  received: DashboardStat;
  paid: DashboardStat;
  // Balances at the period's end; count = customers / vendors with dues.
  receivable: DashboardStat;
  payable: DashboardStat;
  clientCount: number;
  vendorCount: number;
  itemCount: number;
  trend: DashboardTrendMonth[];
  recentInvoices: InvoiceListItem[];
}

export interface SalesTotals {
  count: number;
  subTotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  total: number;
}

export interface SalesReport {
  totals: SalesTotals;
  byMonth: (SalesTotals & { month: string })[];
  byHsn: { hsnSac: string | null; gstRate: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number }[];
}

// Purchase bills for a date range, with the same CGST/SGST/IGST split as sales.
export interface PurchaseTotals {
  count: number;
  subTotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  total: number;
}

export interface PurchaseReport {
  totals: PurchaseTotals;
  byMonth: (PurchaseTotals & { month: string })[];
  byHsn: { hsnSac: string | null; gstRate: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number }[];
}

// Cash & bank book. Accounts: 'cash', 'bank-<id>' per bank account, 'bank' for bank entries saved without an
// account when the business has none. Receipts are money in (debit), payments to vendors money out (credit).
export interface CashBankAccount {
  key: string;
  type: 'cash' | 'bank';
  bankAccountId: number | null;
  bankName: string | null;
  accountNo: string | null;
  // As entered in Business Details (before using the app).
  openingBalance: number;
}

// One account for a period: balance at the start, money in and out, balance at the end.
export interface CashBankSummaryRow extends CashBankAccount {
  periodOpening: number;
  in: number;
  out: number;
  closing: number;
}

export interface CashBankEntry {
  type: 'receipt' | 'payment';
  id: number;
  date: string;
  createdAt?: string | null;
  number: string | null;
  // The customer (receipt) or vendor (payment); clientId when it is a saved party.
  clientId: number | null;
  party: string | null;
  reference: string | null;
  debit: number;
  credit: number;
  // Running balance after this entry.
  balance: number;
}

export interface CashBankLedger {
  account: CashBankAccount;
  from: string | null;
  to: string | null;
  openingBalance: number;
  entries: CashBankEntry[];
  totals: { in: number; out: number; closingBalance: number };
}

export interface SalesExportRow {
  invoiceNumber: string;
  invoiceDate: string;
  status: InvoiceStatus;
  sellerName: string;
  sellerGstin: string | null;
  clientName: string;
  clientAddress: string | null;
  clientStateCode: string;
  clientGstin: string | null;
  placeOfSupplyCode: string;
  reverseCharge: boolean;
  subTotal: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  grandTotal: number;
  lines: Omit<InvoiceLine, 'id' | 'itemId'>[];
}

// Admin (super user) views across every company.
export interface AdminUser {
  id: number;
  name: string;
  username: string;
  email: string | null;
  phone: string;
  isAdmin: boolean;
  createdAt: string;
  company: { id: number; name: string; gstin: string | null };
  stats: { clients: number; items: number; invoices: number; billedTotal: number };
}

export interface AdminUserDetail {
  user: AdminUser;
  company: Company;
  clients: Client[];
  items: Item[];
  invoices: InvoiceListItem[];
}

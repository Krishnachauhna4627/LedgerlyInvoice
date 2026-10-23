// Shapes returned by the backend API.

export interface Company {
  id: number;
  name: string;
  address: string | null;
  stateCode: string | null;
  gstin: string | null;
  bankName: string | null;
  accountNo: string | null;
  ifsc: string | null;
  terms: string | null;
}

export type CompanyInput = Omit<Company, 'id'>;

export interface Client {
  id: number;
  name: string;
  address: string | null;
  stateCode: string;
  gstin: string | null;
  phone: string | null;
  email: string | null;
}

export type ClientInput = Omit<Client, 'id'>;

export interface Item {
  id: number;
  name: string;
  hsnSac: string | null;
  unit: string | null;
  unitPrice: number;
  gstRate: number;
}

export type ItemInput = Omit<Item, 'id'>;

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
  dueDate: string | null;
  status: InvoiceStatus;
  displayStatus: DisplayStatus;
  clientId: number | null;
  clientName: string;
  clientGstin: string | null;
  itemCount: number;
  subTotal: number;
  totalTax: number;
  grandTotal: number;
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
  isInterState: boolean;
  seller: Omit<Company, 'id'>;
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

export interface DashboardSummary {
  thisMonth: { sales: number; invoiceCount: number };
  outstanding: { amount: number; count: number };
  overdue: { amount: number; count: number };
  clientCount: number;
  itemCount: number;
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

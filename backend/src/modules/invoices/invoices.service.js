import { db } from '../../db.js';
import { HttpError } from '../../http-error.js';
import { calculateInvoice } from '../../lib/gst.js';
import { findClient } from '../clients/clients.js';
import { getCompanyRow } from '../company/company.js';

// Today's date in the server's local time zone, as 'YYYY-MM-DD'.
export const today = () => new Date().toLocaleDateString('en-CA');

// "Overdue" is not stored: it's an unpaid invoice whose due date has passed.
export const displayStatus = (row) =>
  row.status === 'unpaid' && row.due_date && row.due_date < today() ? 'overdue' : row.status;

// SQL for the same rule, for filtering lists.
export function whereDisplayStatus(query, status) {
  if (status === 'overdue') {
    return query.where('invoices.status', 'unpaid').whereNotNull('due_date').where('due_date', '<', today());
  }
  if (status === 'unpaid') {
    return query
      .where('invoices.status', 'unpaid')
      .where((q) => q.whereNull('due_date').orWhere('due_date', '>=', today()));
  }
  return query.where('invoices.status', status);
}

export function toListDto(row) {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    status: row.status,
    displayStatus: displayStatus(row),
    clientId: row.client_id,
    clientName: row.client_name,
    clientGstin: row.client_gstin,
    itemCount: row.item_count ?? 0,
    subTotal: row.sub_total,
    totalTax: row.total_tax,
    grandTotal: row.grand_total,
  };
}

function toDetailDto(row, lines) {
  return {
    ...toListDto({ ...row, item_count: lines.length }),
    paidAt: row.paid_at,
    template: row.template,
    reverseCharge: Boolean(row.reverse_charge),
    placeOfSupplyCode: row.place_of_supply_code,
    isInterState: Boolean(row.is_inter_state),
    seller: {
      name: row.seller_name,
      address: row.seller_address,
      stateCode: row.seller_state_code,
      gstin: row.seller_gstin,
      bankName: row.seller_bank_name,
      accountNo: row.seller_account_no,
      ifsc: row.seller_ifsc,
      terms: row.seller_terms,
    },
    client: {
      name: row.client_name,
      address: row.client_address,
      stateCode: row.client_state_code,
      gstin: row.client_gstin,
    },
    totals: {
      subTotal: row.sub_total,
      totalCgst: row.total_cgst,
      totalSgst: row.total_sgst,
      totalIgst: row.total_igst,
      totalTax: row.total_tax,
      grandTotal: row.grand_total,
    },
    lines: lines.map((l) => ({
      id: l.id,
      itemId: l.item_id,
      description: l.description,
      hsnSac: l.hsn_sac,
      quantity: l.quantity,
      unitPrice: l.unit_price,
      gstRate: l.gst_rate,
      taxableAmount: l.taxable_amount,
      cgst: l.cgst,
      sgst: l.sgst,
      igst: l.igst,
      totalTax: l.total_tax,
      lineTotal: l.line_total,
    })),
  };
}

const itemCountSubquery = () =>
  db('invoice_items').count('*').where('invoice_items.invoice_id', db.ref('invoices.id')).as('item_count');

const SORTS = {
  date_desc: [['invoice_date', 'desc'], ['invoices.id', 'desc']],
  date_asc: [['invoice_date', 'asc'], ['invoices.id', 'asc']],
  amount_desc: [['grand_total', 'desc']],
  amount_asc: [['grand_total', 'asc']],
  number_asc: [['invoice_number', 'asc']],
  number_desc: [['invoice_number', 'desc']],
};

export async function listInvoices(companyId, { search, from, to, status, sort, limit }) {
  const query = db('invoices').where('company_id', companyId).select('invoices.*', itemCountSubquery());
  if (search) {
    const like = `%${search}%`;
    query.where((q) =>
      q.where('invoice_number', 'like', like).orWhere('client_name', 'like', like).orWhere('client_gstin', 'like', like),
    );
  }
  if (from) query.where('invoice_date', '>=', from);
  if (to) query.where('invoice_date', '<=', to);
  if (status) whereDisplayStatus(query, status);
  for (const [column, direction] of SORTS[sort]) query.orderBy(column, direction);
  if (limit) query.limit(limit);
  return (await query).map(toListDto);
}

async function findInvoiceRow(companyId, id) {
  const row = await db('invoices').where({ id, company_id: companyId }).first();
  if (!row) {
    throw new HttpError(404, 'Invoice not found.');
  }
  return row;
}

// Admin only: any company's invoice.
export async function getAnyInvoice(id) {
  const row = await db('invoices').where({ id }).first('company_id');
  if (!row) {
    throw new HttpError(404, 'Invoice not found.');
  }
  return getInvoice(row.company_id, id);
}

export async function getInvoice(companyId, id) {
  const row = await findInvoiceRow(companyId, id);
  const lines = await db('invoice_items').where({ invoice_id: id }).orderBy('position');
  return toDetailDto(row, lines);
}

// Next number in the "INV-<year>-0001" series for this company.
export async function nextInvoiceNumber(companyId) {
  const prefix = `INV-${new Date().getFullYear()}-`;
  const rows = await db('invoices').where('company_id', companyId).where('invoice_number', 'like', `${prefix}%`).pluck('invoice_number');
  const highest = rows.reduce((max, number) => {
    const suffix = Number(number.slice(prefix.length));
    return Number.isInteger(suffix) && suffix > max ? suffix : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(4, '0')}`;
}

// Builds the full invoice row (snapshots + server-calculated totals) and its line rows.
async function buildInvoice(companyId, input) {
  const seller = await getCompanyRow(companyId);
  if (!seller.state_code) {
    throw new HttpError(
      400,
      'Please complete your Seller Details in Settings, including the state, before saving an invoice.',
    );
  }
  const client = await findClient(companyId, input.clientId).catch(() => {
    throw new HttpError(400, 'Please fix the highlighted fields.', { clientId: 'Choose a saved client.' });
  });

  const placeOfSupplyCode = input.placeOfSupplyCode ?? client.state_code;
  const { isInterState, lines, totals } = calculateInvoice(input.lines, seller.state_code, placeOfSupplyCode);

  const invoice = {
    company_id: companyId,
    client_id: client.id,
    invoice_number: input.invoiceNumber,
    invoice_date: input.invoiceDate,
    due_date: input.dueDate,
    status: input.status,
    template: input.template,
    reverse_charge: input.reverseCharge,
    place_of_supply_code: placeOfSupplyCode,
    is_inter_state: isInterState,
    seller_name: seller.name,
    seller_address: seller.address,
    seller_state_code: seller.state_code,
    seller_gstin: seller.gstin,
    seller_bank_name: seller.bank_name,
    seller_account_no: seller.account_no,
    seller_ifsc: seller.ifsc,
    seller_terms: seller.terms,
    client_name: client.name,
    client_address: client.address,
    client_state_code: client.state_code,
    client_gstin: client.gstin,
    sub_total: totals.subTotal,
    total_cgst: totals.totalCgst,
    total_sgst: totals.totalSgst,
    total_igst: totals.totalIgst,
    total_tax: totals.totalTax,
    grand_total: totals.grandTotal,
  };

  // Only link lines to saved items that belong to this company.
  const itemIds = [...new Set(lines.map((l) => l.itemId).filter(Boolean))];
  const ownedItemIds = new Set(
    itemIds.length ? await db('items').where('company_id', companyId).whereIn('id', itemIds).pluck('id') : [],
  );
  const lineRows = lines.map((l, index) => ({
    item_id: ownedItemIds.has(l.itemId) ? l.itemId : null,
    position: index + 1,
    description: l.description,
    hsn_sac: l.hsnSac,
    quantity: l.quantity,
    unit_price: l.unitPrice,
    gst_rate: l.gstRate,
    taxable_amount: l.taxableAmount,
    cgst: l.cgst,
    sgst: l.sgst,
    igst: l.igst,
    total_tax: l.totalTax,
    line_total: l.lineTotal,
  }));
  return { invoice, lineRows };
}

function duplicateNumberError(err) {
  if (err.code === 'ER_DUP_ENTRY') {
    return new HttpError(409, 'This invoice number is already used.', {
      invoiceNumber: 'This invoice number is already used.',
    });
  }
  return err;
}

export async function createInvoice(companyId, input) {
  const { invoice, lineRows } = await buildInvoice(companyId, input);
  try {
    const id = await db.transaction(async (trx) => {
      const [invoiceId] = await trx('invoices').insert({
        ...invoice,
        paid_at: input.status === 'paid' ? trx.fn.now() : null,
      });
      await trx('invoice_items').insert(lineRows.map((l) => ({ ...l, invoice_id: invoiceId })));
      return invoiceId;
    });
    return getInvoice(companyId, id);
  } catch (err) {
    throw duplicateNumberError(err);
  }
}

export async function updateInvoice(companyId, id, input) {
  const existing = await findInvoiceRow(companyId, id);
  const { invoice, lineRows } = await buildInvoice(companyId, input);
  const paidAt = input.status !== 'paid' ? null : existing.paid_at ?? db.fn.now();
  try {
    await db.transaction(async (trx) => {
      await trx('invoices').where({ id }).update({ ...invoice, paid_at: paidAt });
      await trx('invoice_items').where({ invoice_id: id }).delete();
      await trx('invoice_items').insert(lineRows.map((l) => ({ ...l, invoice_id: id })));
    });
    return getInvoice(companyId, id);
  } catch (err) {
    throw duplicateNumberError(err);
  }
}

export async function setInvoiceStatus(companyId, id, status) {
  const existing = await findInvoiceRow(companyId, id);
  await db('invoices')
    .where({ id })
    .update({ status, paid_at: status === 'paid' ? existing.paid_at ?? db.fn.now() : null });
  return getInvoice(companyId, id);
}

export async function deleteInvoice(companyId, id) {
  await findInvoiceRow(companyId, id);
  await db('invoices').where({ id }).delete();
}

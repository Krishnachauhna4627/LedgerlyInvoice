import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { round2 } from '../../lib/gst.js';
import { listInvoices, today, whereDisplayStatus } from '../invoices/invoices.service.js';
import { BALANCE_SQL } from '../receipts/ledger.js';

// Drafts are not sales, so every report leaves them out.

const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const sumColumns = (q) =>
  q
    .count('* as count')
    .sum({ subTotal: 'sub_total', cgst: 'total_cgst', sgst: 'total_sgst', igst: 'total_igst', tax: 'total_tax', total: 'grand_total' });

const toNumbers = (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, k === 'month' || k === 'hsnSac' ? v : Number(v ?? 0)]));

function issuedInvoices(companyId, { from, to }) {
  const q = db('invoices').where('invoices.company_id', companyId).whereNot('invoices.status', 'draft');
  if (from) q.where('invoice_date', '>=', from);
  if (to) q.where('invoice_date', '<=', to);
  return q;
}

function outstandingOf(balances) {
  const dues = balances.map((row) => Number(row.balance)).filter((balance) => balance > 0);
  return { amount: round2(dues.reduce((sum, balance) => sum + balance, 0)), count: dues.length };
}

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

reportsRouter.get('/dashboard', async (req, res) => {
  const companyId = req.user.companyId;
  const monthStart = `${today().slice(0, 7)}-01`;
  const sumOf = (q) => q.count('* as count').sum('grand_total as amount').first();

  const [thisMonth, balances, overdue, [{ clients }], [{ items }], recentInvoices] = await Promise.all([
    sumOf(issuedInvoices(companyId, { from: monthStart })),
    db('clients').where({ company_id: companyId }).select(db.raw(`${BALANCE_SQL} AS balance`)),
    sumOf(whereDisplayStatus(db('invoices').where({ company_id: companyId }), 'overdue')),
    db('clients').where({ company_id: companyId }).count('* as clients'),
    db('items').where({ company_id: companyId }).count('* as items'),
    listInvoices(companyId, { sort: 'date_desc', limit: 6 }),
  ]);

  res.json({
    thisMonth: { sales: Number(thisMonth.amount ?? 0), invoiceCount: Number(thisMonth.count) },
    // What customers owe (their balances after receipts); advances don't reduce it. Count = customers with dues.
    outstanding: outstandingOf(balances),
    overdue: { amount: Number(overdue.amount ?? 0), count: Number(overdue.count) },
    clientCount: Number(clients),
    itemCount: Number(items),
    recentInvoices,
  });
});

// Totals, month-by-month and HSN/SAC summary for a date range.
reportsRouter.get('/sales', async (req, res) => {
  const range = rangeSchema.parse(req.query);
  const companyId = req.user.companyId;

  const [totals, byMonth, byHsn] = await Promise.all([
    sumColumns(issuedInvoices(companyId, range)).first(),
    sumColumns(issuedInvoices(companyId, range))
      .select(db.raw("DATE_FORMAT(invoice_date, '%Y-%m') as month"))
      .groupBy('month')
      .orderBy('month'),
    issuedInvoices(companyId, range)
      .join('invoice_items', 'invoice_items.invoice_id', 'invoices.id')
      .select('invoice_items.hsn_sac as hsnSac', 'invoice_items.gst_rate as gstRate')
      .sum({
        taxable: 'invoice_items.taxable_amount',
        cgst: 'invoice_items.cgst',
        sgst: 'invoice_items.sgst',
        igst: 'invoice_items.igst',
        tax: 'invoice_items.total_tax',
      })
      .groupBy('invoice_items.hsn_sac', 'invoice_items.gst_rate')
      .orderBy('invoice_items.hsn_sac'),
  ]);

  res.json({ totals: toNumbers(totals), byMonth: byMonth.map(toNumbers), byHsn: byHsn.map(toNumbers) });
});

// Every issued invoice in the range with its lines, for the CSV exports.
reportsRouter.get('/sales/export', async (req, res) => {
  const range = rangeSchema.parse(req.query);
  const invoices = await issuedInvoices(req.user.companyId, range).orderBy('invoice_date').orderBy('id');
  const lines = invoices.length
    ? await db('invoice_items').whereIn('invoice_id', invoices.map((i) => i.id)).orderBy(['invoice_id', 'position'])
    : [];
  const linesByInvoice = Map.groupBy(lines, (l) => l.invoice_id);
  res.json(
    invoices.map((inv) => ({
      invoiceNumber: inv.invoice_number,
      invoiceDate: inv.invoice_date,
      status: inv.status,
      sellerName: inv.seller_name,
      sellerGstin: inv.seller_gstin,
      clientName: inv.client_name,
      clientAddress: inv.client_address,
      clientStateCode: inv.client_state_code,
      clientGstin: inv.client_gstin,
      placeOfSupplyCode: inv.place_of_supply_code,
      reverseCharge: Boolean(inv.reverse_charge),
      subTotal: inv.sub_total,
      totalCgst: inv.total_cgst,
      totalSgst: inv.total_sgst,
      totalIgst: inv.total_igst,
      totalTax: inv.total_tax,
      grandTotal: inv.grand_total,
      lines: (linesByInvoice.get(inv.id) ?? []).map((l) => ({
        description: l.description,
        narration: l.narration,
        hsnSac: l.hsn_sac,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unit_price,
        gstRate: l.gst_rate,
        taxableAmount: l.taxable_amount,
        cgst: l.cgst,
        sgst: l.sgst,
        igst: l.igst,
        totalTax: l.total_tax,
        lineTotal: l.line_total,
      })),
    })),
  );
});

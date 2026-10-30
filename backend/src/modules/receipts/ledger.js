import { db } from '../../db.js';
import { round2 } from '../../lib/gst.js';

// A customer's balance: opening balance + sales (every invoice except drafts) − receipts.
// Positive means the customer owes us (Dr, due); negative means they paid in advance (Cr).
// Used as a column expression on the clients table.
export const BALANCE_SQL = `clients.opening_balance
  + COALESCE((SELECT SUM(i.grand_total) FROM invoices i WHERE i.client_id = clients.id AND i.status <> 'draft'), 0)
  - COALESCE((SELECT SUM(r.amount) FROM receipts r WHERE r.client_id = clients.id), 0)`;

// Receipts settle the oldest invoices first (after the opening balance): every invoice they fully
// cover is paid, the rest unpaid. Call after anything that changes a customer's receipts, invoices
// or opening balance. Drafts are left alone.
export async function settleInvoices(clientId) {
  if (!clientId) return;
  const client = await db('clients').where({ id: clientId }).first('opening_balance');
  if (!client) return;
  const [{ received }] = await db('receipts').where({ client_id: clientId }).sum({ received: 'amount' });
  let credit = round2(Number(received ?? 0) - client.opening_balance);
  let covered = true;

  const invoices = await db('invoices')
    .where({ client_id: clientId })
    .whereNot('status', 'draft')
    .orderBy([{ column: 'invoice_date' }, { column: 'id' }])
    .select('id', 'status', 'grand_total');
  for (const invoice of invoices) {
    covered = covered && credit >= invoice.grand_total;
    if (covered) credit = round2(credit - invoice.grand_total);
    const status = covered ? 'paid' : 'unpaid';
    if (status !== invoice.status) {
      await db('invoices').where({ id: invoice.id }).update({ status, paid_at: covered ? db.fn.now() : null });
    }
  }
}

// Date-wise ledger of one customer (a clients row): sales are debits, receipts credits, with a
// running balance. Entries before `from` are folded into the opening balance; entries after `to` are left out.
export async function getLedger(client, { from, to }) {
  const [invoices, receipts] = await Promise.all([
    db('invoices')
      .where({ client_id: client.id })
      .whereNot('status', 'draft')
      .select('id', 'invoice_number', 'invoice_date', 'grand_total'),
    db('receipts').where({ client_id: client.id }).select('id', 'receipt_date', 'mode', 'amount', 'reference'),
  ]);
  const all = [
    ...invoices.map((i) => ({
      type: 'sale',
      id: i.id,
      date: i.invoice_date,
      invoiceNumber: i.invoice_number,
      mode: null,
      reference: null,
      debit: i.grand_total,
      credit: 0,
    })),
    ...receipts.map((r) => ({
      type: 'receipt',
      id: r.id,
      date: r.receipt_date,
      invoiceNumber: null,
      mode: r.mode,
      reference: r.reference,
      debit: 0,
      credit: r.amount,
    })),
  ];
  // By date; on the same day sales come before receipts, then in the order they were entered.
  all.sort((a, b) => a.date.localeCompare(b.date) || (a.type === 'sale' ? -1 : 1) - (b.type === 'sale' ? -1 : 1) || a.id - b.id);

  let balance = client.opening_balance;
  const entries = [];
  for (const entry of all) {
    if (to && entry.date > to) break;
    balance = round2(balance + entry.debit - entry.credit);
    if (!from || entry.date >= from) entries.push({ ...entry, balance });
  }
  const openingBalance = round2(balance - entries.reduce((sum, e) => sum + e.debit - e.credit, 0));
  const sales = round2(entries.reduce((sum, e) => sum + e.debit, 0));
  const received = round2(entries.reduce((sum, e) => sum + e.credit, 0));
  return {
    from: from ?? null,
    to: to ?? null,
    openingBalance,
    entries,
    totals: { sales, receipts: received, closingBalance: balance },
  };
}

// Per customer: receipt money left over after the opening balance and the paid invoices, and the
// oldest unpaid invoice (the one that leftover partly pays — see settleInvoices).
const PART_PAYMENT_SQL = `clients.id,
  COALESCE((SELECT SUM(r.amount) FROM receipts r WHERE r.client_id = clients.id), 0)
  - clients.opening_balance
  - COALESCE((SELECT SUM(i.grand_total) FROM invoices i WHERE i.client_id = clients.id AND i.status = 'paid'), 0) AS leftover,
  (SELECT i.id FROM invoices i WHERE i.client_id = clients.id AND i.status = 'unpaid'
    ORDER BY i.invoice_date, i.id LIMIT 1) AS first_unpaid_id`;

// Sets amount_due on invoice rows: 0 when paid; for the customer's oldest unpaid invoice, its total
// minus any part payment; otherwise the full total.
export async function withAmountDue(rows) {
  const clientIds = [...new Set(rows.filter((r) => r.status === 'unpaid' && r.client_id).map((r) => r.client_id))];
  const parts = clientIds.length ? await db('clients').whereIn('clients.id', clientIds).select(db.raw(PART_PAYMENT_SQL)) : [];
  const partByClient = new Map(parts.map((p) => [p.id, p]));
  return rows.map((row) => {
    const part = partByClient.get(row.client_id);
    const leftover = part && part.first_unpaid_id === row.id ? Number(part.leftover) : 0;
    const due = row.status === 'paid' ? 0 : leftover > 0 ? Math.max(round2(row.grand_total - leftover), 0) : row.grand_total;
    return { ...row, amount_due: due };
  });
}

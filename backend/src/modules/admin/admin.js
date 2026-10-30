import { Router } from 'express';
import { db } from '../../db.js';
import { HttpError } from '../../http-error.js';
import { idParam } from '../../lib/validation.js';
import { requireAdmin, requireAuth } from '../../middleware/require-auth.js';
import { clientsWithBalance, toClientDto } from '../clients/clients.js';
import { getCompanyRow, toCompanyDto } from '../company/company.js';
import { getAnyInvoice, toListDto } from '../invoices/invoices.service.js';
import { withAmountDue } from '../receipts/ledger.js';
import { toItemDto } from '../items/items.js';

// Super-user views across every company. Read-only; the only place that skips company scoping.

const countFor = (table, alias) =>
  db(table).count('*').where(`${table}.company_id`, db.ref('users.company_id')).as(alias);

// Drafts aren't issued yet, so they don't count as billed.
const billedFor = () =>
  db('invoices')
    .sum('grand_total')
    .where('invoices.company_id', db.ref('users.company_id'))
    .whereNot('status', 'draft')
    .as('billed_total');

function toUserDto(row) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    phone: row.phone,
    isAdmin: Boolean(row.is_admin),
    createdAt: row.created_at,
    company: { id: row.company_id, name: row.company_name, gstin: row.company_gstin },
    stats: {
      clients: Number(row.client_count),
      items: Number(row.item_count),
      invoices: Number(row.invoice_count),
      billedTotal: Number(row.billed_total ?? 0),
    },
  };
}

const usersQuery = () =>
  db('users')
    .join('companies', 'companies.id', 'users.company_id')
    .select(
      'users.id',
      'users.name',
      'users.username',
      'users.email',
      'users.phone',
      'users.is_admin',
      'users.created_at',
      'users.company_id',
      'companies.name as company_name',
      'companies.gstin as company_gstin',
      countFor('clients', 'client_count'),
      countFor('items', 'item_count'),
      countFor('invoices', 'invoice_count'),
      billedFor(),
    );

const invoiceItemCount = () =>
  db('invoice_items').count('*').where('invoice_items.invoice_id', db.ref('invoices.id')).as('item_count');

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/users', async (req, res) => {
  const rows = await usersQuery().orderBy('users.created_at', 'desc');
  res.json(rows.map(toUserDto));
});

// One user with everything their company owns.
adminRouter.get('/users/:id', async (req, res) => {
  const row = await usersQuery().where('users.id', idParam.parse(req.params.id)).first();
  if (!row) {
    throw new HttpError(404, 'User not found.');
  }
  const companyId = row.company_id;
  const [company, clients, items, invoices] = await Promise.all([
    getCompanyRow(companyId),
    clientsWithBalance().where({ company_id: companyId }).orderBy('name'),
    db('items').where({ company_id: companyId }).orderBy('name'),
    db('invoices')
      .where({ company_id: companyId })
      .select('invoices.*', invoiceItemCount())
      .orderBy([
        { column: 'invoice_date', order: 'desc' },
        { column: 'id', order: 'desc' },
      ]),
  ]);
  res.json({
    user: toUserDto(row),
    company: toCompanyDto(company),
    clients: clients.map(toClientDto),
    items: items.map(toItemDto),
    invoices: (await withAmountDue(invoices)).map(toListDto),
  });
});

adminRouter.get('/invoices/:id', async (req, res) => {
  res.json(await getAnyInvoice(idParam.parse(req.params.id)));
});

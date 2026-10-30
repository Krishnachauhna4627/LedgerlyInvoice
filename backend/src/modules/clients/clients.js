import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db.js';
import { HttpError } from '../../http-error.js';
import { gstin, idParam, optionalEmail, optionalPhone, optionalText, requiredText, stateCode } from '../../lib/validation.js';
import { round2 } from '../../lib/gst.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { validate } from '../../middleware/validate.js';
import { BALANCE_SQL, getLedger, settleInvoices } from '../receipts/ledger.js';

const clientSchema = z
  .object({
    name: requiredText('Customer name', 150),
    address: optionalText('Address', 1000),
    stateCode,
    gstin,
    phone: optionalPhone,
    email: optionalEmail,
    // Owed before using the app: positive = due (Dr), negative = advance (Cr).
    openingBalance: z.coerce
      .number({ error: 'Opening balance must be a number.' })
      .min(-9_999_999_999, 'Opening balance is too large.')
      .max(9_999_999_999, 'Opening balance is too large.')
      .optional()
      .transform((value) => round2(value ?? 0)),
  })
  .refine((c) => !c.gstin || c.gstin.startsWith(c.stateCode), {
    path: ['gstin'],
    message: 'GSTIN must start with the selected state code.',
  });

export function toClientDto(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    stateCode: row.state_code,
    gstin: row.gstin,
    phone: row.phone,
    email: row.email,
    openingBalance: row.opening_balance,
    balance: round2(Number(row.balance)),
  };
}

// clients.* plus the current balance (see BALANCE_SQL); toClientDto needs both.
export const clientsWithBalance = () => db('clients').select('clients.*', db.raw(`${BALANCE_SQL} AS balance`));

// Only ever returns a client that belongs to the given company.
export async function findClient(companyId, id) {
  const row = await clientsWithBalance().where({ 'clients.id': id, company_id: companyId }).first();
  if (!row) {
    throw new HttpError(404, 'Customer not found.');
  }
  return row;
}

const toRow = (b) => ({
  name: b.name,
  address: b.address,
  state_code: b.stateCode,
  gstin: b.gstin,
  phone: b.phone,
  email: b.email,
  opening_balance: b.openingBalance,
});

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

clientsRouter.get('/', async (req, res) => {
  const rows = await clientsWithBalance().where({ company_id: req.user.companyId }).orderBy('name');
  res.json(rows.map(toClientDto));
});

clientsRouter.get('/:id', async (req, res) => {
  res.json(toClientDto(await findClient(req.user.companyId, idParam.parse(req.params.id))));
});

const ledgerQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Date-wise sales, receipts and running balance for one customer.
clientsRouter.get('/:id/ledger', async (req, res) => {
  const client = await findClient(req.user.companyId, idParam.parse(req.params.id));
  const query = ledgerQuerySchema.safeParse(req.query);
  res.json({ client: toClientDto(client), ...(await getLedger(client, query.success ? query.data : {})) });
});

clientsRouter.post('/', validate(clientSchema), async (req, res) => {
  const [id] = await db('clients').insert({ ...toRow(req.body), company_id: req.user.companyId });
  res.status(201).json(toClientDto(await findClient(req.user.companyId, id)));
});

clientsRouter.put('/:id', validate(clientSchema), async (req, res) => {
  const { id } = await findClient(req.user.companyId, idParam.parse(req.params.id));
  await db('clients').where({ id }).update(toRow(req.body));
  await settleInvoices(id);
  res.json(toClientDto(await findClient(req.user.companyId, id)));
});

// Invoices keep their own copy of the client's details, so deleting a client never changes them.
// Receipts don't, so a customer with receipts stays (their ledger would lose entries).
clientsRouter.delete('/:id', async (req, res) => {
  const { id } = await findClient(req.user.companyId, idParam.parse(req.params.id));
  if (await db('receipts').where({ client_id: id }).first('id')) {
    throw new HttpError(409, 'This customer has receipts. Delete their receipts first.');
  }
  await db('clients').where({ id }).delete();
  res.status(204).end();
});

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db.js';
import { HttpError } from '../../http-error.js';
import { idParam, isoDate, optionalText } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { validate } from '../../middleware/validate.js';
import { findClient } from '../clients/clients.js';
import { settleInvoices } from './ledger.js';

export const RECEIPT_MODES = ['cash', 'bank'];

const receiptSchema = z.object({
  clientId: z.coerce.number({ error: 'Choose a customer.' }).int().positive('Choose a customer.'),
  receiptDate: isoDate('Receipt date'),
  mode: z.enum(RECEIPT_MODES, { error: 'Choose cash or bank.' }),
  amount: z.coerce
    .number({ error: 'Amount must be a number.' })
    .positive('Amount must be more than 0.')
    .max(9_999_999_999, 'Amount is too large.'),
  reference: optionalText('Narration', 100),
});

const listQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  clientId: z.coerce.number().int().positive().optional(),
  mode: z.enum(RECEIPT_MODES).optional(),
});

function toReceiptDto(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    receiptDate: row.receipt_date,
    mode: row.mode,
    amount: row.amount,
    reference: row.reference,
  };
}

const receiptsQuery = (companyId) =>
  db('receipts')
    .join('clients', 'clients.id', 'receipts.client_id')
    .where('receipts.company_id', companyId)
    .select('receipts.*', 'clients.name as client_name');

async function findReceipt(companyId, id) {
  const row = await receiptsQuery(companyId).where('receipts.id', id).first();
  if (!row) {
    throw new HttpError(404, 'Receipt not found.');
  }
  return row;
}

// The receipt's customer must be one of this company's saved customers.
async function ownedClientId(companyId, clientId) {
  const client = await findClient(companyId, clientId).catch(() => {
    throw new HttpError(400, 'Please fix the highlighted fields.', { clientId: 'Choose a saved customer.' });
  });
  return client.id;
}

const toRow = (b, clientId) => ({
  client_id: clientId,
  receipt_date: b.receiptDate,
  mode: b.mode,
  amount: b.amount,
  reference: b.reference,
});

export const receiptsRouter = Router();
receiptsRouter.use(requireAuth);

receiptsRouter.get('/', async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  const { from, to, clientId, mode } = parsed.success ? parsed.data : {};
  const query = receiptsQuery(req.user.companyId).orderBy([
    { column: 'receipt_date', order: 'desc' },
    { column: 'receipts.id', order: 'desc' },
  ]);
  if (from) query.where('receipt_date', '>=', from);
  if (to) query.where('receipt_date', '<=', to);
  if (clientId) query.where('receipts.client_id', clientId);
  if (mode) query.where('mode', mode);
  res.json((await query).map(toReceiptDto));
});

receiptsRouter.post('/', validate(receiptSchema), async (req, res) => {
  const clientId = await ownedClientId(req.user.companyId, req.body.clientId);
  const [id] = await db('receipts').insert({ ...toRow(req.body, clientId), company_id: req.user.companyId });
  await settleInvoices(clientId);
  res.status(201).json(toReceiptDto(await findReceipt(req.user.companyId, id)));
});

receiptsRouter.put('/:id', validate(receiptSchema), async (req, res) => {
  const existing = await findReceipt(req.user.companyId, idParam.parse(req.params.id));
  const clientId = await ownedClientId(req.user.companyId, req.body.clientId);
  await db('receipts').where({ id: existing.id }).update(toRow(req.body, clientId));
  await settleInvoices(clientId);
  if (existing.client_id !== clientId) await settleInvoices(existing.client_id);
  res.json(toReceiptDto(await findReceipt(req.user.companyId, existing.id)));
});

receiptsRouter.delete('/:id', async (req, res) => {
  const existing = await findReceipt(req.user.companyId, idParam.parse(req.params.id));
  await db('receipts').where({ id: existing.id }).delete();
  await settleInvoices(existing.client_id);
  res.status(204).end();
});

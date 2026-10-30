import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db.js';
import { HttpError } from '../../http-error.js';
import { gstin, idParam, optionalEmail, optionalPhone, optionalText, requiredText, stateCode } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { validate } from '../../middleware/validate.js';

const clientSchema = z
  .object({
    name: requiredText('Customer name', 150),
    address: optionalText('Address', 1000),
    stateCode,
    gstin,
    phone: optionalPhone,
    email: optionalEmail,
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
  };
}

// Only ever returns a client that belongs to the given company.
export async function findClient(companyId, id) {
  const row = await db('clients').where({ id, company_id: companyId }).first();
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
});

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

clientsRouter.get('/', async (req, res) => {
  const rows = await db('clients').where({ company_id: req.user.companyId }).orderBy('name');
  res.json(rows.map(toClientDto));
});

clientsRouter.get('/:id', async (req, res) => {
  res.json(toClientDto(await findClient(req.user.companyId, idParam.parse(req.params.id))));
});

clientsRouter.post('/', validate(clientSchema), async (req, res) => {
  const [id] = await db('clients').insert({ ...toRow(req.body), company_id: req.user.companyId });
  res.status(201).json(toClientDto(await findClient(req.user.companyId, id)));
});

clientsRouter.put('/:id', validate(clientSchema), async (req, res) => {
  const { id } = await findClient(req.user.companyId, idParam.parse(req.params.id));
  await db('clients').where({ id }).update(toRow(req.body));
  res.json(toClientDto(await findClient(req.user.companyId, id)));
});

// Invoices keep their own copy of the client's details, so deleting a client never changes them.
clientsRouter.delete('/:id', async (req, res) => {
  const { id } = await findClient(req.user.companyId, idParam.parse(req.params.id));
  await db('clients').where({ id }).delete();
  res.status(204).end();
});

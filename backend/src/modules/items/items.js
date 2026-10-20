import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db.js';
import { HttpError } from '../../http-error.js';
import { gstRate, idParam, money, optionalText, requiredText } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { validate } from '../../middleware/validate.js';

const itemSchema = z.object({
  name: requiredText('Item name', 200),
  hsnSac: optionalText('HSN/SAC', 20),
  unitPrice: money('Rate'),
  gstRate,
});

export function toItemDto(row) {
  return { id: row.id, name: row.name, hsnSac: row.hsn_sac, unitPrice: row.unit_price, gstRate: row.gst_rate };
}

async function findItem(companyId, id) {
  const row = await db('items').where({ id, company_id: companyId }).first();
  if (!row) {
    throw new HttpError(404, 'Item not found.');
  }
  return row;
}

const toRow = (b) => ({ name: b.name, hsn_sac: b.hsnSac, unit_price: b.unitPrice, gst_rate: b.gstRate });

export const itemsRouter = Router();
itemsRouter.use(requireAuth);

itemsRouter.get('/', async (req, res) => {
  const rows = await db('items').where({ company_id: req.user.companyId }).orderBy('name');
  res.json(rows.map(toItemDto));
});

itemsRouter.post('/', validate(itemSchema), async (req, res) => {
  const [id] = await db('items').insert({ ...toRow(req.body), company_id: req.user.companyId });
  res.status(201).json(toItemDto(await findItem(req.user.companyId, id)));
});

itemsRouter.put('/:id', validate(itemSchema), async (req, res) => {
  const { id } = await findItem(req.user.companyId, idParam.parse(req.params.id));
  await db('items').where({ id }).update(toRow(req.body));
  res.json(toItemDto(await findItem(req.user.companyId, id)));
});

itemsRouter.delete('/:id', async (req, res) => {
  const { id } = await findItem(req.user.companyId, idParam.parse(req.params.id));
  await db('items').where({ id }).delete();
  res.status(204).end();
});

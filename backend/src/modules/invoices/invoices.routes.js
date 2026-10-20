import { Router } from 'express';
import { db } from '../../db.js';
import { idParam } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createInvoice,
  deleteInvoice,
  getInvoice,
  listInvoices,
  nextInvoiceNumber,
  setInvoiceStatus,
  updateInvoice,
} from './invoices.service.js';
import { invoiceSchema, listQuerySchema, statusSchema } from './invoices.validation.js';

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);

invoicesRouter.get('/', async (req, res) => {
  const query = listQuerySchema.safeParse(req.query);
  res.json(await listInvoices(req.user.companyId, query.success ? query.data : { sort: 'date_desc' }));
});

invoicesRouter.get('/count', async (req, res) => {
  const [{ count }] = await db('invoices').where('company_id', req.user.companyId).count('* as count');
  res.json({ count: Number(count) });
});

invoicesRouter.get('/next-number', async (req, res) => {
  res.json({ invoiceNumber: await nextInvoiceNumber(req.user.companyId) });
});

invoicesRouter.get('/:id', async (req, res) => {
  res.json(await getInvoice(req.user.companyId, idParam.parse(req.params.id)));
});

invoicesRouter.post('/', validate(invoiceSchema), async (req, res) => {
  res.status(201).json(await createInvoice(req.user.companyId, req.body));
});

invoicesRouter.put('/:id', validate(invoiceSchema), async (req, res) => {
  res.json(await updateInvoice(req.user.companyId, idParam.parse(req.params.id), req.body));
});

invoicesRouter.patch('/:id/status', validate(statusSchema), async (req, res) => {
  res.json(await setInvoiceStatus(req.user.companyId, idParam.parse(req.params.id), req.body.status));
});

invoicesRouter.delete('/:id', async (req, res) => {
  await deleteInvoice(req.user.companyId, idParam.parse(req.params.id));
  res.status(204).end();
});

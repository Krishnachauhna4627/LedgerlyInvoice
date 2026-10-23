import { z } from 'zod';
import { gstRate, isoDate, money, optionalText, requiredText, stateCode } from '../../lib/validation.js';

export const INVOICE_STATUSES = ['draft', 'unpaid', 'paid'];
export const INVOICE_TEMPLATES = ['classic', 'modern', 'minimal'];

const lineSchema = z.object({
  itemId: z.coerce.number().int().positive().nullish().transform((value) => value ?? null),
  description: requiredText('Item', 200),
  hsnSac: optionalText('HSN/SAC', 20),
  quantity: z.coerce
    .number({ error: 'Quantity must be a number.' })
    .positive('Quantity must be more than 0.')
    .max(1_000_000_000, 'Quantity is too large.'),
  unitPrice: money('Rate'),
  gstRate,
});

export const invoiceSchema = z
  .object({
    clientId: z.coerce.number({ error: 'Choose a client.' }).int().positive('Choose a client.'),
    invoiceNumber: requiredText('Invoice number', 40),
    invoiceDate: isoDate('Invoice date'),
    dueDate: isoDate('Due date').nullish().transform((value) => value || null),
    placeOfSupplyCode: stateCode.nullish().transform((value) => value || null),
    reverseCharge: z.boolean().default(false),
    template: z.enum(INVOICE_TEMPLATES).default('classic'),
    status: z.enum(INVOICE_STATUSES).default('unpaid'),
    lines: z.array(lineSchema, { error: 'Add at least one item.' }).min(1, 'Add at least one item.').max(200),
  })
  .refine((inv) => !inv.dueDate || inv.dueDate >= inv.invoiceDate, {
    path: ['dueDate'],
    message: "Due date can't be before the invoice date.",
  });

export const statusSchema = z.object({
  status: z.enum(INVOICE_STATUSES, { error: 'Choose a valid status.' }),
});

export const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum([...INVOICE_STATUSES, 'overdue']).optional(),
  sort: z.enum(['date_desc', 'date_asc', 'amount_desc', 'amount_asc', 'number_asc', 'number_desc']).default('date_desc'),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

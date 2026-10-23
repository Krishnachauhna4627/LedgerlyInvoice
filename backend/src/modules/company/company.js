import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db.js';
import { gstin, optionalEmail, optionalPhone, optionalText, requiredText, stateCode } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { validate } from '../../middleware/validate.js';

// The logged-in user's own business ("seller") details.

const sellerSchema = z.object({
  name: requiredText('Business name', 150),
  address: optionalText('Address', 1000),
  stateCode: stateCode.nullish().transform((value) => value || null),
  gstin,
  phone: optionalPhone,
  email: optionalEmail,
  bankName: optionalText('Bank name', 100),
  accountNo: optionalText('Account number', 34),
  ifsc: optionalText('IFSC code', 11).transform((value) => value?.toUpperCase() ?? null),
  terms: optionalText('Terms', 4000),
});

// Max length of the stored data URL (~180 KB image); the frontend resizes signatures well below this.
const MAX_SIGNATURE_LENGTH = 250_000;

const signatureSchema = z.object({
  signature: z
    .string({ error: 'Choose a signature image.' })
    .max(MAX_SIGNATURE_LENGTH, 'Signature image is too large.')
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/, 'Upload a PNG, JPG or WebP image.'),
});

const COLUMNS = [
  'id',
  'name',
  'address',
  'state_code',
  'gstin',
  'phone',
  'email',
  'bank_name',
  'account_no',
  'ifsc',
  'terms',
  'signature',
];

export function toCompanyDto(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    stateCode: row.state_code,
    gstin: row.gstin,
    phone: row.phone,
    email: row.email,
    bankName: row.bank_name,
    accountNo: row.account_no,
    ifsc: row.ifsc,
    terms: row.terms,
    signature: row.signature,
  };
}

export function getCompanyRow(companyId) {
  return db('companies').where({ id: companyId }).first(COLUMNS);
}

export const companyRouter = Router();
companyRouter.use(requireAuth);

companyRouter.get('/', async (req, res) => {
  res.json(toCompanyDto(await getCompanyRow(req.user.companyId)));
});

companyRouter.put('/', validate(sellerSchema), async (req, res) => {
  const b = req.body;
  await db('companies').where({ id: req.user.companyId }).update({
    name: b.name,
    address: b.address,
    state_code: b.stateCode,
    gstin: b.gstin,
    phone: b.phone,
    email: b.email,
    bank_name: b.bankName,
    account_no: b.accountNo,
    ifsc: b.ifsc,
    terms: b.terms,
  });
  res.json(toCompanyDto(await getCompanyRow(req.user.companyId)));
});

companyRouter.put('/signature', validate(signatureSchema), async (req, res) => {
  await db('companies').where({ id: req.user.companyId }).update({ signature: req.body.signature });
  res.json(toCompanyDto(await getCompanyRow(req.user.companyId)));
});

companyRouter.delete('/signature', async (req, res) => {
  await db('companies').where({ id: req.user.companyId }).update({ signature: null });
  res.json(toCompanyDto(await getCompanyRow(req.user.companyId)));
});

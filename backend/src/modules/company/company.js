import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db.js';
import { gstin, optionalText, requiredText, stateCode } from '../../lib/validation.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { validate } from '../../middleware/validate.js';

// The logged-in user's own business ("seller") details.

const sellerSchema = z.object({
  name: requiredText('Business name', 150),
  address: optionalText('Address', 1000),
  stateCode: stateCode.nullish().transform((value) => value || null),
  gstin,
  bankName: optionalText('Bank name', 100),
  accountNo: optionalText('Account number', 34),
  ifsc: optionalText('IFSC code', 11).transform((value) => value?.toUpperCase() ?? null),
  terms: optionalText('Terms', 4000),
});

const COLUMNS = ['id', 'name', 'address', 'state_code', 'gstin', 'bank_name', 'account_no', 'ifsc', 'terms'];

export function toCompanyDto(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    stateCode: row.state_code,
    gstin: row.gstin,
    bankName: row.bank_name,
    accountNo: row.account_no,
    ifsc: row.ifsc,
    terms: row.terms,
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
    bank_name: b.bankName,
    account_no: b.accountNo,
    ifsc: b.ifsc,
    terms: b.terms,
  });
  res.json(toCompanyDto(await getCompanyRow(req.user.companyId)));
});

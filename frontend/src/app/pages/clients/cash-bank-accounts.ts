import { BankAccountInput, Company, CompanyInput } from '../../core/data/models';

// The company as it is now, with new bank accounts / cash opening balance: what PUT /api/company expects.
export function companyInput(c: Company, bankAccounts: BankAccountInput[], cashOpeningBalance: number): CompanyInput {
  return {
    name: c.name,
    address: c.address,
    stateCode: c.stateCode,
    gstin: c.gstin,
    phone: c.phone,
    email: c.email,
    terms: c.terms,
    cashOpeningBalance,
    bankAccounts,
  };
}

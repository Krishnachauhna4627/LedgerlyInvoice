import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { toApiError } from '../../../../core/api/api-error';
import { CompanyService } from '../../../../core/data/company.service';
import { BankAccountInput, CashBankAccount, Company } from '../../../../core/data/models';
import { companyInput } from '../../cash-bank-accounts';

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function ifscValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim().toUpperCase();
  return value && !IFSC_PATTERN.test(value) ? { pattern: true } : null;
}

// Edit cash in hand (its opening balance) or a bank account (name, number, IFSC, opening balance) from the
// Ledgers page. These live in Business Details, so saving sends the whole company back with only this changed.
@Component({
  selector: 'app-cash-bank-form',
  imports: [ReactiveFormsModule],
  templateUrl: './cash-bank-form.html',
  styleUrl: './cash-bank-form.scss',
})
export class CashBankForm implements OnInit {
  private readonly companyService = inject(CompanyService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly company = input.required<Company>();
  // The account to edit; null adds a new bank account.
  readonly account = input<CashBankAccount | null>(null);
  readonly saved = output<Company>();
  readonly cancelled = output();

  protected readonly isCash = computed(() => this.account()?.type === 'cash');
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.group({
    bankName: ['', Validators.maxLength(100)],
    accountNo: ['', Validators.maxLength(34)],
    ifsc: ['', ifscValidator],
    openingBalance: this.fb.control<number | null>(0),
    primary: [false],
  });

  ngOnInit(): void {
    const c = this.company();
    const a = this.account();
    if (a?.type === 'cash') {
      this.form.patchValue({ openingBalance: c.cashOpeningBalance ?? 0 });
      return;
    }
    const bank = c.bankAccounts.find((b) => b.id === a?.bankAccountId);
    this.form.patchValue({
      bankName: bank?.bankName ?? '',
      accountNo: bank?.accountNo ?? '',
      ifsc: bank?.ifsc ?? '',
      openingBalance: bank?.openingBalance ?? 0,
      primary: !!bank && c.bankAccounts[0]?.id === bank.id,
    });
  }

  protected errorFor(field: 'bankName' | 'accountNo' | 'ifsc'): string | null {
    const control = this.form.controls[field];
    if (!control.errors || !(control.touched || this.submitted())) return null;
    if (control.errors['server']) return control.errors['server'];
    if (field === 'ifsc') return 'Enter a valid 11-character IFSC (e.g. HDFC0001234).';
    return field === 'bankName' ? 'Bank name is too long.' : 'Account number is too long.';
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.submitting()) return;
    const v = this.form.getRawValue();
    const blank = (s: string) => s.trim() || null;
    const opening = Number(v.openingBalance) || 0;
    const c = this.company();
    let cashOpening = c.cashOpeningBalance ?? 0;
    let accounts: BankAccountInput[] = c.bankAccounts.map((b) => ({ ...b }));

    if (this.isCash()) {
      cashOpening = opening;
    } else {
      const edited: BankAccountInput = {
        id: this.account()?.bankAccountId ?? null,
        bankName: blank(v.bankName),
        accountNo: blank(v.accountNo),
        ifsc: blank(v.ifsc)?.toUpperCase() ?? null,
        openingBalance: opening,
      };
      if (!edited.bankName && !edited.accountNo && !edited.ifsc) {
        this.error.set('Enter the bank name, account number or IFSC.');
        return;
      }
      const index = accounts.findIndex((b) => b.id !== null && b.id === edited.id);
      if (index >= 0) accounts[index] = edited;
      else accounts.push(edited);
      // The first account is the primary one, printed on invoices.
      if (v.primary) accounts = [edited, ...accounts.filter((b) => b !== edited)];
    }

    this.submitting.set(true);
    this.error.set(null);
    this.companyService.update(companyInput(c, accounts, cashOpening)).subscribe({
      next: (company) => {
        this.submitting.set(false);
        this.saved.emit(company);
      },
      error: (err: unknown) => {
        this.error.set(toApiError(err).message);
        this.submitting.set(false);
      },
    });
  }
}

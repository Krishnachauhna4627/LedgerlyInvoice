import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { toApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { CompanyService } from '../../core/data/company.service';
import { BankAccount, Company, CompanyInput } from '../../core/data/models';
import { GST_STATES, GSTIN_PATTERN } from '../../core/gst/gst-states';
import { MOBILE_PATTERN, toMobileDigits } from '../../core/ui/phone';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon/icon';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SIGNATURE_TYPES, signatureDataUrl } from './signature-image';

type Field = 'name' | 'address' | 'stateCode' | 'gstin' | 'phone' | 'email' | 'terms';
type BankField = 'bankName' | 'accountNo' | 'ifsc';
type BankAccountGroup = FormGroup<Record<BankField, FormControl<string>> & { id: FormControl<number | null> }>;

// Same limit as the backend.
const MAX_BANK_ACCOUNTS = 10;

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const MESSAGES: Record<Field | BankField, Record<string, string>> = {
  name: { required: 'Business name is required.', maxlength: 'Business name is too long.' },
  address: { maxlength: 'Address is too long.' },
  stateCode: {},
  gstin: { pattern: 'Enter a valid 15-character GSTIN.', stateMismatch: 'GSTIN must start with your state code.' },
  phone: { pattern: 'Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.' },
  email: { email: 'Enter a valid email address.', maxlength: 'Email is too long.' },
  bankName: { maxlength: 'Bank name is too long.' },
  accountNo: { maxlength: 'Account number is too long.' },
  ifsc: { pattern: 'Enter a valid 11-character IFSC (e.g. HDFC0001234).' },
  terms: { maxlength: 'Terms are too long.' },
};

function gstinValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim().toUpperCase();
  if (!value) return null;
  if (!GSTIN_PATTERN.test(value)) return { pattern: true };
  const stateCode = control.parent?.get('stateCode')?.value;
  return stateCode && !value.startsWith(stateCode) ? { stateMismatch: true } : null;
}

function ifscValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim().toUpperCase();
  return value && !IFSC_PATTERN.test(value) ? { pattern: true } : null;
}

// Seller details printed on every new invoice.
@Component({
  selector: 'app-settings-page',
  imports: [ReactiveFormsModule, PageHeader, Icon],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private readonly companyService = inject(CompanyService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly states = GST_STATES;
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    address: ['', Validators.maxLength(1000)],
    stateCode: [''],
    gstin: ['', gstinValidator],
    phone: ['', Validators.pattern(MOBILE_PATTERN)],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    terms: ['', Validators.maxLength(4000)],
    // The first account is the primary one, printed on invoices.
    bankAccounts: this.fb.array<BankAccountGroup>([]),
  });
  protected readonly maxBankAccounts = MAX_BANK_ACCOUNTS;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly missingState = signal(false);
  protected readonly signature = signal<string | null>(null);
  protected readonly signatureBusy = signal(false);
  protected readonly signatureError = signal<string | null>(null);
  protected readonly signatureTypes = SIGNATURE_TYPES.join(',');

  constructor() {
    this.form.controls.stateCode.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((code) => {
        this.form.controls.gstin.updateValueAndValidity();
        this.missingState.set(!code);
      });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.companyService.get().subscribe({
      next: (company) => {
        this.fill(company);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toApiError(err).message);
        this.loading.set(false);
      },
    });
  }

  protected onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = toMobileDigits(input.value);
    if (digits !== input.value) {
      input.value = digits;
      this.form.controls.phone.setValue(digits);
    }
  }

  // Saved straight away (separately from the form), so it never mixes with unsaved edits.
  protected async onSignatureFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.signatureBusy()) return;
    this.signatureError.set(null);
    this.signatureBusy.set(true);
    try {
      const dataUrl = await signatureDataUrl(file);
      this.companyService.uploadSignature(dataUrl).subscribe({
        next: (company) => {
          this.signature.set(company.signature);
          this.signatureBusy.set(false);
          this.toast.success('Signature saved');
        },
        error: (err: unknown) => {
          this.signatureError.set(toApiError(err).message);
          this.signatureBusy.set(false);
        },
      });
    } catch (err) {
      this.signatureError.set(err instanceof Error ? err.message : 'Could not read that image.');
      this.signatureBusy.set(false);
    }
  }

  protected removeSignature(): void {
    if (this.signatureBusy()) return;
    this.signatureBusy.set(true);
    this.signatureError.set(null);
    this.companyService.removeSignature().subscribe({
      next: () => {
        this.signature.set(null);
        this.signatureBusy.set(false);
        this.toast.success('Signature removed');
      },
      error: (err: unknown) => {
        this.signatureError.set(toApiError(err).message);
        this.signatureBusy.set(false);
      },
    });
  }

  protected get bankAccounts(): FormArray<BankAccountGroup> {
    return this.form.controls.bankAccounts;
  }

  protected addBankAccount(): void {
    if (this.bankAccounts.length >= MAX_BANK_ACCOUNTS) return;
    this.bankAccounts.push(this.bankAccountGroup());
    this.form.markAsDirty();
  }

  protected removeBankAccount(index: number): void {
    this.bankAccounts.removeAt(index);
    this.form.markAsDirty();
  }

  // Moves the account to the top, so it is printed on invoices.
  protected makePrimary(index: number): void {
    const account = this.bankAccounts.at(index);
    this.bankAccounts.removeAt(index);
    this.bankAccounts.insert(0, account);
    this.form.markAsDirty();
  }

  protected bankErrorFor(index: number, field: BankField): string | null {
    return this.messageFor(this.bankAccounts.at(index).controls[field], field);
  }

  protected errorFor(field: Field): string | null {
    return this.messageFor(this.form.controls[field], field);
  }

  private messageFor(control: AbstractControl, field: Field | BankField): string | null {
    if (!control.errors || !(control.touched || this.submitted())) return null;
    if (control.errors['server']) return control.errors['server'];
    return MESSAGES[field][Object.keys(control.errors)[0]] ?? 'Please check this field.';
  }

  protected save(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const blank = (s: string) => s.trim() || null;
    const input: CompanyInput = {
      name: v.name.trim(),
      address: blank(v.address),
      stateCode: v.stateCode || null,
      gstin: blank(v.gstin)?.toUpperCase() ?? null,
      phone: v.phone || null,
      email: blank(v.email)?.toLowerCase() ?? null,
      terms: blank(v.terms),
      bankAccounts: v.bankAccounts
        .map((a) => ({ id: a.id, bankName: blank(a.bankName), accountNo: blank(a.accountNo), ifsc: blank(a.ifsc)?.toUpperCase() ?? null }))
        .filter((a) => a.bankName || a.accountNo || a.ifsc),
    };
    this.saving.set(true);
    this.error.set(null);
    this.companyService.update(input).subscribe({
      next: (company) => {
        this.fill(company);
        // Keep the sidebar's company name in step.
        this.auth.user.update((u) => u && { ...u, company: { ...u.company, name: company.name } });
        this.toast.success('Business details saved');
        this.saving.set(false);
        this.submitted.set(false);
      },
      error: (err: unknown) => {
        const { message, fieldErrors } = toApiError(err);
        for (const [field, msg] of Object.entries(fieldErrors)) this.form.get(field)?.setErrors({ server: msg });
        this.error.set(message);
        this.saving.set(false);
      },
    });
  }

  protected reset(): void {
    this.load();
    this.submitted.set(false);
    this.error.set(null);
  }

  private fill(c: Company): void {
    this.form.reset({
      name: c.name,
      address: c.address ?? '',
      stateCode: c.stateCode ?? '',
      gstin: c.gstin ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      terms: c.terms ?? '',
    });
    this.bankAccounts.clear();
    // Start with one empty account so the fields are ready to fill in.
    const accounts = c.bankAccounts.length ? c.bankAccounts : [null];
    for (const account of accounts) this.bankAccounts.push(this.bankAccountGroup(account));
    this.form.markAsPristine();
    this.missingState.set(!c.stateCode);
    this.signature.set(c.signature);
  }

  private bankAccountGroup(account: BankAccount | null = null): BankAccountGroup {
    return this.fb.group({
      id: this.fb.control<number | null>(account?.id ?? null),
      bankName: [account?.bankName ?? '', Validators.maxLength(100)],
      accountNo: [account?.accountNo ?? '', Validators.maxLength(34)],
      ifsc: [account?.ifsc ?? '', ifscValidator],
    });
  }
}

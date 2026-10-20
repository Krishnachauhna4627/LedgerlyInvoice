import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { toApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { CompanyService } from '../../core/data/company.service';
import { Company, CompanyInput } from '../../core/data/models';
import { GST_STATES, GSTIN_PATTERN } from '../../core/gst/gst-states';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon/icon';
import { PageHeader } from '../../shared/components/page-header/page-header';

type Field = 'name' | 'address' | 'stateCode' | 'gstin' | 'bankName' | 'accountNo' | 'ifsc' | 'terms';

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const MESSAGES: Record<Field, Record<string, string>> = {
  name: { required: 'Business name is required.', maxlength: 'Business name is too long.' },
  address: { maxlength: 'Address is too long.' },
  stateCode: {},
  gstin: { pattern: 'Enter a valid 15-character GSTIN.', stateMismatch: 'GSTIN must start with your state code.' },
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
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    address: ['', Validators.maxLength(1000)],
    stateCode: [''],
    gstin: ['', gstinValidator],
    bankName: ['', Validators.maxLength(100)],
    accountNo: ['', Validators.maxLength(34)],
    ifsc: ['', ifscValidator],
    terms: ['', Validators.maxLength(4000)],
  });

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly missingState = signal(false);

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

  protected errorFor(field: Field): string | null {
    const control = this.form.controls[field];
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
      bankName: blank(v.bankName),
      accountNo: blank(v.accountNo),
      ifsc: blank(v.ifsc)?.toUpperCase() ?? null,
      terms: blank(v.terms),
    };
    this.saving.set(true);
    this.error.set(null);
    this.companyService.update(input).subscribe({
      next: (company) => {
        this.fill(company);
        // Keep the sidebar's company name in step.
        this.auth.user.update((u) => u && { ...u, company: { ...u.company, name: company.name } });
        this.toast.success('Settings saved');
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
      bankName: c.bankName ?? '',
      accountNo: c.accountNo ?? '',
      ifsc: c.ifsc ?? '',
      terms: c.terms ?? '',
    });
    this.missingState.set(!c.stateCode);
  }
}

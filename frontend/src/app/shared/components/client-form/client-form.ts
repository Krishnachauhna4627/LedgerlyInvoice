import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { toApiError } from '../../../core/api/api-error';
import { ClientService } from '../../../core/data/client.service';
import { Client, ClientInput } from '../../../core/data/models';
import { GST_STATES, GSTIN_PATTERN } from '../../../core/gst/gst-states';
import { ToastService } from '../../../core/ui/toast.service';

type Field = 'name' | 'address' | 'stateCode' | 'gstin' | 'phone' | 'email';

const MESSAGES: Record<Field, Record<string, string>> = {
  name: { required: 'Client name is required.', maxlength: 'Client name is too long.' },
  address: { maxlength: 'Address is too long.' },
  stateCode: { required: 'Choose a state.' },
  gstin: { pattern: 'Enter a valid 15-character GSTIN.', stateMismatch: 'GSTIN must start with the selected state code.' },
  phone: { pattern: 'Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.' },
  email: { email: 'Enter a valid email address.', maxlength: 'Email is too long.' },
};

// Same rules as the server: optional, 15-char format, first two digits = state code.
function gstinValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim().toUpperCase();
  if (!value) return null;
  if (!GSTIN_PATTERN.test(value)) return { pattern: true };
  const stateCode = control.parent?.get('stateCode')?.value;
  return stateCode && !value.startsWith(stateCode) ? { stateMismatch: true } : null;
}

// Add / edit a saved client. Emits the saved client; the parent closes its modal.
@Component({
  selector: 'app-client-form',
  imports: [ReactiveFormsModule],
  templateUrl: './client-form.html',
  styleUrl: './client-form.scss',
})
export class ClientForm implements OnInit {
  private readonly clients = inject(ClientService);
  private readonly toast = inject(ToastService);

  readonly client = input<Client | null>(null);
  readonly saved = output<Client>();
  readonly cancelled = output();

  protected readonly states = GST_STATES;
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    address: ['', Validators.maxLength(1000)],
    stateCode: ['', Validators.required],
    gstin: ['', gstinValidator],
    // Indian mobile number, same rule as the server.
    phone: ['', Validators.pattern(/^[6-9]\d{9}$/)],
    email: ['', [Validators.email, Validators.maxLength(254)]],
  });
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // The GSTIN check depends on the state, so re-run it when the state changes.
    this.form.controls.stateCode.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.gstin.updateValueAndValidity());
  }

  ngOnInit(): void {
    const c = this.client();
    if (c) {
      this.form.setValue({
        name: c.name,
        address: c.address ?? '',
        stateCode: c.stateCode,
        gstin: c.gstin ?? '',
        phone: c.phone ?? '',
        email: c.email ?? '',
      });
    }
  }

  // Keep the mobile field to digits only, at most 10; a pasted +91 / 0 prefix is dropped.
  protected onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value
      .replace(/\D/g, '')
      .replace(/^(?:91|0)(?=\d{10}$)/, '')
      .slice(0, 10);
    if (digits !== input.value) {
      input.value = digits;
      this.form.controls.phone.setValue(digits);
    }
  }

  protected errorFor(field: Field): string | null {
    const control = this.form.controls[field];
    if (!control.errors || !(control.touched || this.submitted())) return null;
    if (control.errors['server']) return control.errors['server'];
    return MESSAGES[field][Object.keys(control.errors)[0]] ?? 'Please check this field.';
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.submitting()) return;
    const v = this.form.getRawValue();
    const input: ClientInput = {
      name: v.name.trim(),
      address: v.address.trim() || null,
      stateCode: v.stateCode,
      gstin: v.gstin.trim().toUpperCase() || null,
      phone: v.phone || null,
      email: v.email.trim().toLowerCase() || null,
    };
    const existing = this.client();
    this.submitting.set(true);
    this.error.set(null);
    (existing ? this.clients.update(existing.id, input) : this.clients.create(input)).subscribe({
      next: (client) => {
        this.toast.success(existing ? 'Client updated' : 'Client added');
        this.saved.emit(client);
      },
      error: (err: unknown) => {
        const { message, fieldErrors } = toApiError(err);
        for (const [field, msg] of Object.entries(fieldErrors)) this.form.get(field)?.setErrors({ server: msg });
        this.error.set(message);
        this.submitting.set(false);
      },
    });
  }
}

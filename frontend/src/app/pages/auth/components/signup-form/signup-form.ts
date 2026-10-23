import { Component, inject, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { toApiError } from '../../../../core/api/api-error';
import { AuthService } from '../../../../core/auth/auth.service';
import { Modal } from '../../../../shared/components/modal/modal';
import { LEGAL_TITLES, LegalContent, LegalDoc } from '../legal-content/legal-content';

type Field = 'name' | 'username' | 'email' | 'phone' | 'company' | 'password' | 'acceptTerms';

// Same rules as the backend (auth.validation.js); the backend has the final say.
const MESSAGES: Record<Field, Record<string, string>> = {
  name: { required: 'Name is required.' },
  username: {
    required: 'Username is required.',
    pattern: 'Use 3–30 letters, numbers, dots or underscores.',
  },
  email: {
    required: 'Email is required.',
    email: 'Enter a valid email address.',
    maxlength: 'Email is too long.',
  },
  phone: {
    required: 'Phone number is required.',
    pattern: 'Enter a valid phone number (10–15 digits).',
  },
  company: { required: 'Company name is required.' },
  password: {
    required: 'Password is required.',
    minlength: 'Password must be at least 8 characters.',
    maxlength: 'Password is too long.',
  },
  acceptTerms: { required: 'Please accept the Terms & Conditions and Privacy Policy.' },
};

@Component({
  selector: 'app-signup-form',
  imports: [ReactiveFormsModule, Modal, LegalContent],
  templateUrl: './signup-form.html',
  styleUrl: './signup-form.scss',
})
export class SignupForm {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loginRequested = output();

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    username: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9._]{3,30}$/)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    phone: ['', [Validators.required, Validators.pattern(/^\+?(?:[\s-]*\d){10,15}[\s-]*$/)]],
    company: ['', [Validators.required, Validators.maxLength(150)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    acceptTerms: [false, Validators.requiredTrue],
  });
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  // Which legal document is open in the modal, if any.
  protected readonly legalDoc = signal<LegalDoc | null>(null);
  protected readonly legalTitles = LEGAL_TITLES;

  protected errorFor(field: Field): string | null {
    const control = this.form.controls[field];
    if (!control.errors || !(control.touched || this.submitted())) {
      return null;
    }
    if (control.errors['server']) {
      return control.errors['server'];
    }
    const key = Object.keys(control.errors)[0];
    return MESSAGES[field][key] ?? 'Please check this field.';
  }

  // "I agree" in the legal modal ticks the checkbox for the user.
  protected acceptLegal(): void {
    this.form.controls.acceptTerms.setValue(true);
    this.form.controls.acceptTerms.markAsTouched();
    this.legalDoc.set(null);
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    const { acceptTerms, ...body } = this.form.getRawValue();
    this.auth.signup(body).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (err: unknown) => {
        const { message, fieldErrors } = toApiError(err);
        for (const [field, fieldMessage] of Object.entries(fieldErrors)) {
          this.form.get(field)?.setErrors({ server: fieldMessage });
        }
        this.error.set(message);
        this.submitting.set(false);
      },
    });
  }
}

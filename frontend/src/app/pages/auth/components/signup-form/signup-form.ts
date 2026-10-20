import { Component, inject, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { toApiError } from '../../../../core/api/api-error';
import { AuthService } from '../../../../core/auth/auth.service';

type Field = 'name' | 'username' | 'phone' | 'company' | 'password';

// Same rules as the backend (auth.validation.js); the backend has the final say.
const MESSAGES: Record<Field, Record<string, string>> = {
  name: { required: 'Name is required.' },
  username: {
    required: 'Username is required.',
    pattern: 'Use 3–30 letters, numbers, dots or underscores.',
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
};

@Component({
  selector: 'app-signup-form',
  imports: [ReactiveFormsModule],
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
    phone: ['', [Validators.required, Validators.pattern(/^\+?(?:[\s-]*\d){10,15}[\s-]*$/)]],
    company: ['', [Validators.required, Validators.maxLength(150)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
  });
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

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

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.auth.signup(this.form.getRawValue()).subscribe({
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

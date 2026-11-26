import { Location } from '@angular/common';
import { Component, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { toApiError } from '../../../../core/api/api-error';
import { AuthService } from '../../../../core/auth/auth.service';
import { NEW_PASSWORD_VALIDATORS, PASSWORD_HINT, PASSWORD_STRENGTH_MESSAGES } from '../../../../core/auth/password-rules';

type Field = 'password' | 'confirmPassword';

// Same rules as the backend (Config\Validation passwordReset); the backend has the final say.
const MESSAGES: Record<Field, Record<string, string>> = {
  password: {
    required: 'New password is required.',
    minlength: 'Password must be at least 8 characters.',
    maxlength: 'Password is too long.',
    ...PASSWORD_STRENGTH_MESSAGES,
  },
  confirmPassword: { required: 'Confirm your new password.', mismatch: "Passwords don't match." },
};

function matchesPassword(control: AbstractControl): ValidationErrors | null {
  const password = control.parent?.get('password')?.value;
  return control.value && control.value !== password ? { mismatch: true } : null;
}

// /reset-password?token=… (the link in the "Forgot password" email): choose a new password.
// The token is taken out of the address bar straight away so it isn't left in history or shared by accident.
@Component({
  selector: 'app-reset-password-form',
  imports: [ReactiveFormsModule],
  templateUrl: './reset-password-form.html',
  styleUrl: './reset-password-form.scss',
})
export class ResetPasswordForm {
  private readonly auth = inject(AuthService);

  readonly loginRequested = output();
  readonly forgotRequested = output();

  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';
  protected readonly hasToken = /^[0-9a-f]{64}$/.test(this.token);
  protected readonly passwordHint = PASSWORD_HINT;
  protected readonly form = inject(NonNullableFormBuilder).group({
    password: ['', NEW_PASSWORD_VALIDATORS],
    confirmPassword: ['', [Validators.required, matchesPassword]],
  });
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal(false);

  constructor() {
    inject(Location).replaceState('/reset-password');
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.confirmPassword.updateValueAndValidity());
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
    this.submitting.set(true);
    this.error.set(null);
    this.auth.resetPassword(this.token, this.form.getRawValue().password).subscribe({
      next: () => {
        // Every session of the account has ended on the server; end this browser's too, if any.
        if (this.auth.isLoggedIn()) this.auth.logout();
        this.done.set(true);
        this.submitting.set(false);
      },
      error: (err: unknown) => {
        const { message, fieldErrors } = toApiError(err);
        if (fieldErrors['password']) this.form.controls.password.setErrors({ server: fieldErrors['password'] });
        this.error.set(message);
        this.submitting.set(false);
      },
    });
  }
}

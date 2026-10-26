import { Component, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { toApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/ui/toast.service';

type Field = 'currentPassword' | 'newPassword' | 'confirmPassword';

// Same rules as the backend (auth.validation.js passwordChangeSchema); the backend has the final say.
const MESSAGES: Record<Field, Record<string, string>> = {
  currentPassword: { required: 'Current password is required.' },
  newPassword: {
    required: 'New password is required.',
    minlength: 'New password must be at least 8 characters.',
    maxlength: 'New password is too long.',
  },
  confirmPassword: { required: 'Confirm your new password.', mismatch: "Passwords don't match." },
};

function matchesNewPassword(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.parent?.get('newPassword')?.value;
  return control.value && control.value !== newPassword ? { mismatch: true } : null;
}

// Change the logged-in user's password. Emits when saved; the parent closes its modal.
@Component({
  selector: 'app-password-form',
  imports: [ReactiveFormsModule],
  templateUrl: './password-form.html',
  styleUrl: './password-form.scss',
})
export class PasswordForm {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly saved = output();
  readonly cancelled = output();

  protected readonly username = this.auth.user()?.username ?? '';
  protected readonly form = inject(NonNullableFormBuilder).group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    confirmPassword: ['', [Validators.required, matchesNewPassword]],
  });
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // The match check depends on the new password, so re-run it when that changes.
    this.form.controls.newPassword.valueChanges
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
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.auth.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.toast.success('Password changed');
        this.saved.emit();
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

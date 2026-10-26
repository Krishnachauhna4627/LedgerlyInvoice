import { Component, inject, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toApiError } from '../../../../core/api/api-error';
import { AuthService } from '../../../../core/auth/auth.service';

// Asks for the account's email; the backend emails it a new password.
@Component({
  selector: 'app-forgot-password-form',
  imports: [ReactiveFormsModule],
  templateUrl: './forgot-password-form.html',
  styleUrl: './forgot-password-form.scss',
})
export class ForgotPasswordForm {
  private readonly auth = inject(AuthService);

  readonly loginRequested = output();

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  // The confirmation from the server once the request went through.
  protected readonly sentMessage = signal<string | null>(null);

  protected emailError(): string | null {
    const control = this.form.controls.email;
    if (!control.errors || !(control.touched || this.submitted())) return null;
    if (control.errors['server']) return control.errors['server'];
    if (control.errors['required']) return 'Email is required.';
    if (control.errors['maxlength']) return 'Email is too long.';
    return 'Enter a valid email address.';
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.auth.forgotPassword(this.form.getRawValue().email.trim().toLowerCase()).subscribe({
      next: (message) => {
        this.sentMessage.set(message);
        this.submitting.set(false);
      },
      error: (err: unknown) => {
        const { message, fieldErrors } = toApiError(err);
        if (fieldErrors['email']) this.form.controls.email.setErrors({ server: fieldErrors['email'] });
        this.error.set(message);
        this.submitting.set(false);
      },
    });
  }
}

import { Component, OnInit, inject, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/ui/toast.service';

type Field = 'name' | 'username' | 'email' | 'phone';

// Same rules as the backend (auth.validation.js profileSchema); the backend has the final say.
const MESSAGES: Record<Field, Record<string, string>> = {
  name: { required: 'Name is required.', maxlength: 'Name is too long.' },
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
};

// Edit the logged-in user's own details. Emits when saved; the parent closes its modal.
@Component({
  selector: 'app-profile-form',
  imports: [ReactiveFormsModule],
  templateUrl: './profile-form.html',
  styleUrl: './profile-form.scss',
})
export class ProfileForm implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly saved = output();
  readonly cancelled = output();
  readonly passwordRequested = output();

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    username: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9._]{3,30}$/)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    phone: ['', [Validators.required, Validators.pattern(/^\+?(?:[\s-]*\d){10,15}[\s-]*$/)]],
  });
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const user = this.auth.user();
    if (user) {
      this.form.setValue({
        name: user.name,
        username: user.username,
        email: user.email ?? '',
        phone: user.phone,
      });
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
    this.submitting.set(true);
    this.error.set(null);
    this.auth.updateProfile(this.form.getRawValue()).subscribe({
      next: () => {
        this.toast.success('Profile updated');
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

import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';

// Rules for a password someone chooses (signup, change password). Same rules as the backend
// (Config\Validation NEW_PASSWORD_RULES + LedgerlyRules::password_*); the backend has the final say.
// Login is not checked against these, so older passwords keep working.

export const PASSWORD_HINT = 'At least 8 characters, with a capital letter, a number and a special character (like @ # $ !).';

// One missing requirement at a time, so the message says exactly what to add.
export function passwordStrength(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value ?? '';
  if (!value) return null; // "required" reports an empty field.
  if (!/[A-Z]/.test(value)) return { uppercase: true };
  if (!/[0-9]/.test(value)) return { number: true };
  if (!/[^A-Za-z0-9\s]/.test(value)) return { special: true };
  return null;
}

export const NEW_PASSWORD_VALIDATORS = [Validators.required, Validators.minLength(8), Validators.maxLength(72), passwordStrength];

export const PASSWORD_STRENGTH_MESSAGES: Record<string, string> = {
  uppercase: 'Password must include at least one capital letter (A–Z).',
  number: 'Password must include at least one number (0–9).',
  special: 'Password must include at least one special character, like @ # $ !',
};

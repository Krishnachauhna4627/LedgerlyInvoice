// Indian 10-digit mobile number (starts with 6–9). Same rule as the server (lib/validation.js).
export const MOBILE_PATTERN = /^[6-9]\d{9}$/;

// Digits only, at most 10; a pasted +91 / 0 prefix is dropped.
export function toMobileDigits(value: string): string {
  return value
    .replace(/\D/g, '')
    .replace(/^(?:91|0)(?=\d{10}$)/, '')
    .slice(0, 10);
}

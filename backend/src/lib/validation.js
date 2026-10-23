import { z } from 'zod';
import { GST_STATE_CODES, GSTIN_PATTERN } from './gst.js';

// Reusable zod pieces with user-friendly messages.
export const text = (message) => z.string({ error: message });

export const requiredText = (label, max) =>
  text(`${label} is required.`).trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);

// Empty strings become null so optional columns stay NULL rather than ''.
export const optionalText = (label, max) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long.`)
    .nullish()
    .transform((value) => value || null);

export const stateCode = z.enum(GST_STATE_CODES, { error: 'Choose a valid state.' });

export const gstin = z
  .string()
  .trim()
  .toUpperCase()
  .nullish()
  .transform((value) => value || null)
  .refine((value) => value === null || GSTIN_PATTERN.test(value), 'Enter a valid 15-character GSTIN.');

// Optional contact fields, empty → null.
// Indian mobile: 10 digits starting with 6–9. Spaces/dashes and a +91 / 0 prefix are ignored.
export const optionalPhone = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, '').replace(/^(?:\+91|0)(?=\d{10}$)/, ''))
  .nullish()
  .transform((value) => value || null)
  .refine((value) => value === null || /^[6-9]\d{9}$/.test(value), 'Enter a valid 10-digit mobile number.');

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long.')
  .nullish()
  .transform((value) => value || null)
  .refine((value) => value === null || z.email().safeParse(value).success, 'Enter a valid email address.');

export const isoDate = (label) =>
  text(`${label} is required.`).regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a valid date.`);

export const money = (label) =>
  z.coerce
    .number({ error: `${label} must be a number.` })
    .min(0, `${label} can't be negative.`)
    .max(9_999_999_999, `${label} is too large.`);

export const gstRate = z.coerce
  .number({ error: 'GST % must be a number.' })
  .min(0, "GST % can't be negative.")
  .max(100, 'GST % must be 100 or less.');

export const idParam = z.coerce.number().int().positive();

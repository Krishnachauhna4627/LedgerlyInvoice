import { z } from 'zod';

// A string field whose "missing / wrong type" error is a friendly message.
const text = (message) => z.string({ error: message });

const username = text('Username is required.')
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._]{3,30}$/, 'Use 3–30 letters, numbers, dots or underscores.');

const email = text('Email is required.')
  .trim()
  .toLowerCase()
  .min(1, 'Email is required.')
  .max(254, 'Email is too long.')
  .pipe(z.email('Enter a valid email address.'));

export const loginSchema = z.object({
  // Username or email.
  login: text('Username or email is required.').trim().toLowerCase().min(1, 'Username or email is required.'),
  password: text('Password is required.').min(1, 'Password is required.'),
});

export const signupSchema = z.object({
  name: text('Name is required.').trim().min(1, 'Name is required.').max(100, 'Name is too long.'),
  username,
  email,
  phone: text('Phone number is required.')
    .transform((value) => value.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^\+?\d{10,15}$/, 'Enter a valid phone number (10–15 digits).')),
  company: text('Company name is required.')
    .trim()
    .min(1, 'Company name is required.')
    .max(150, 'Company name is too long.'),
  // bcrypt only uses the first 72 bytes.
  password: text('Password is required.')
    .min(8, 'Password must be at least 8 characters.')
    .max(72, 'Password is too long.'),
});

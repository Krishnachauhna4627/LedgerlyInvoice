import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth.js';
import { validate } from '../../middleware/validate.js';
import { changePassword, getUserById, login, resetPassword, signup, updateProfile } from './auth.service.js';
import { forgotPasswordSchema, loginSchema, passwordChangeSchema, profileSchema, signupSchema } from './auth.validation.js';

export const authRouter = Router();

authRouter.post('/signup', validate(signupSchema), async (req, res) => {
  res.status(201).json(await signup(req.body));
});

authRouter.post('/login', validate(loginSchema), async (req, res) => {
  res.json(await login(req.body));
});

// Same answer whether or not the email has an account; the email is sent in the background.
authRouter.post('/forgot-password', validate(forgotPasswordSchema), (req, res) => {
  resetPassword(req.body).catch((err) => console.error('Password reset failed:', err));
  res.json({ message: 'If an account exists for that email, we have sent it a new password.' });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ user: await getUserById(req.user.id) });
});

authRouter.put('/me', requireAuth, validate(profileSchema), async (req, res) => {
  res.json({ user: await updateProfile(req.user.id, req.body) });
});

authRouter.put('/me/password', requireAuth, validate(passwordChangeSchema), async (req, res) => {
  await changePassword(req.user.id, req.body);
  res.status(204).end();
});

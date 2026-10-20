import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth.js';
import { validate } from '../../middleware/validate.js';
import { getUserById, login, signup } from './auth.service.js';
import { loginSchema, signupSchema } from './auth.validation.js';

export const authRouter = Router();

authRouter.post('/signup', validate(signupSchema), async (req, res) => {
  res.status(201).json(await signup(req.body));
});

authRouter.post('/login', validate(loginSchema), async (req, res) => {
  res.json(await login(req.body));
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ user: await getUserById(req.user.id) });
});

import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../http-error.js';

// Expects "Authorization: Bearer <token>"; sets req.userId.
export function requireAuth(req, res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Please log in.'));
  }
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.userId = Number(payload.sub);
    next();
  } catch {
    next(new HttpError(401, 'Your session has expired. Please log in again.'));
  }
}

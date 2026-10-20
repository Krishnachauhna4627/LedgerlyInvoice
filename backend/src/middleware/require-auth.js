import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db.js';
import { HttpError } from '../http-error.js';

// Expects "Authorization: Bearer <token>"; sets req.user = { id, companyId }.
// Every query for business data must be scoped by req.user.companyId.
export async function requireAuth(req, res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, 'Please log in.');
  }
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch {
    throw new HttpError(401, 'Your session has expired. Please log in again.');
  }
  const user = await db('users').where({ id: Number(payload.sub) }).first('id', 'company_id');
  if (!user) {
    throw new HttpError(401, 'Please log in.');
  }
  req.user = { id: user.id, companyId: user.company_id };
  next();
}

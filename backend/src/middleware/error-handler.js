import { HttpError } from '../http-error.js';

export function notFound(req, res) {
  res.status(404).json({ message: 'Not found.' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, ...(err.errors && { errors: err.errors }) });
  }
  // Bad ids / query values parsed with zod outside validate().
  if (err.name === 'ZodError') {
    return res.status(404).json({ message: 'Not found.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body must be valid JSON.' });
  }
  console.error(err);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
}

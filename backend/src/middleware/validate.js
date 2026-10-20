// Validates req.body against a zod schema; on failure responds 400 with { message, errors: { field: message } }.
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const errors = {};
    for (const issue of result.error.issues) {
      errors[issue.path.join('.')] ??= issue.message;
    }
    return res.status(400).json({ message: 'Please fix the highlighted fields.', errors });
  }
  req.body = result.data;
  next();
};

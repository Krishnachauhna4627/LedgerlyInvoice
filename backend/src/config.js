// Loads backend/.env (if present) and exposes typed settings. Missing required values stop startup.
try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // No .env file — rely on real environment variables.
}

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name} (see .env.example)`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  // Comma-separated list, e.g. http://localhost:4200,https://ledgerly-invoice.vercel.app
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:4200').split(',').map((origin) => origin.trim()),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: required('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    database: required('DB_NAME'),
  },
  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  // Outgoing email (forgot password). Without SMTP_HOST, emails are printed to the console instead.
  mail: {
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT) || 587,
    // true for port 465 (TLS from the start); false for 587 / 25 (STARTTLS).
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.MAIL_FROM || 'Gogna <no-reply@localhost>',
  },
};

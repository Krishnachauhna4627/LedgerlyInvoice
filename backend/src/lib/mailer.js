import nodemailer from 'nodemailer';
import { config } from '../config.js';

const transport = config.mail.host
  ? nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    })
  : null;

// Sends a plain-text email. Without SMTP settings (development), prints it to the console instead.
export async function sendMail({ to, subject, text }) {
  if (!transport) {
    console.log(`[mail] To: ${to}\n[mail] Subject: ${subject}\n${text}`);
    return;
  }
  await transport.sendMail({ from: config.mail.from, to, subject, text });
}

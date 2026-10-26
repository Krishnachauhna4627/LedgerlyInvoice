import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config.js';
import { db } from '../../db.js';
import { HttpError } from '../../http-error.js';
import { sendMail } from '../../lib/mailer.js';

const BCRYPT_ROUNDS = 12;
// Compared against when the account doesn't exist, so response time doesn't reveal which usernames/emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

function toPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    phone: row.phone,
    isAdmin: Boolean(row.is_admin),
    company: { id: row.company_id, name: row.company_name },
  };
}

export async function getUserById(id) {
  const row = await db('users')
    .join('companies', 'companies.id', 'users.company_id')
    .where('users.id', id)
    .first(
      'users.id',
      'users.name',
      'users.username',
      'users.email',
      'users.phone',
      'users.is_admin',
      'users.company_id',
      'companies.name as company_name',
    );
  return row ? toPublicUser(row) : null;
}

function createSession(user) {
  const token = jwt.sign({ sub: String(user.id) }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
  return { token, user };
}

export async function signup({ name, username, email, phone, company, password }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  let userId;
  try {
    userId = await db.transaction(async (trx) => {
      const [companyId] = await trx('companies').insert({ name: company });
      const [id] = await trx('users').insert({
        company_id: companyId,
        name,
        username,
        email,
        phone,
        password_hash: passwordHash,
      });
      return id;
    });
  } catch (err) {
    throw toDuplicateError(err);
  }
  return createSession(await getUserById(userId));
}

export async function updateProfile(id, { name, username, email, phone }) {
  try {
    await db('users').where({ id }).update({ name, username, email, phone });
  } catch (err) {
    throw toDuplicateError(err);
  }
  return getUserById(id);
}

export async function changePassword(id, { currentPassword, newPassword }) {
  const row = await db('users').where({ id }).first('password_hash');
  if (!row || !(await bcrypt.compare(currentPassword, row.password_hash))) {
    throw new HttpError(400, 'Current password is incorrect.', { currentPassword: 'Current password is incorrect.' });
  }
  await db('users')
    .where({ id })
    .update({ password_hash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) });
}

// No 0/O/1/l/I so the emailed password is easy to type.
const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const TEMP_PASSWORD_LENGTH = 12;
// One reset per email per window, so repeated clicks (or someone else) can't keep replacing the password.
const RESET_COOLDOWN_MS = 5 * 60 * 1000;
const lastResetAt = new Map();

function generateTempPassword() {
  const pick = () => TEMP_PASSWORD_CHARS[randomInt(TEMP_PASSWORD_CHARS.length)];
  return Array.from({ length: TEMP_PASSWORD_LENGTH }, pick).join('');
}

// Emails the account a new random password, then saves it (email first, so a failed send leaves the old one working).
// Runs after the response is sent and never reports whether the email has an account.
export async function resetPassword({ email }) {
  const now = Date.now();
  if (now - (lastResetAt.get(email) ?? 0) < RESET_COOLDOWN_MS) {
    return;
  }
  lastResetAt.set(email, now);

  const user = await db('users').where({ email }).first('id', 'name', 'username');
  if (!user) {
    return;
  }
  const password = generateTempPassword();
  await sendMail({
    to: email,
    subject: 'Your new Gogna password',
    text: [
      `Hi ${user.name},`,
      '',
      'We received a request to reset your Gogna password. Your new password is:',
      '',
      `    ${password}`,
      '',
      `Log in with your username (${user.username}) or this email, then change it from your profile: click your name at the bottom of the sidebar → Change password.`,
      '',
      "If you didn't ask for this, log in with the password above and change it right away.",
    ].join('\n'),
  });
  await db('users')
    .where({ id: user.id })
    .update({ password_hash: await bcrypt.hash(password, BCRYPT_ROUNDS) });
}

// Username and email are unique; turn a clash into a message on the right field.
function toDuplicateError(err) {
  if (err.code !== 'ER_DUP_ENTRY') {
    return err;
  }
  if (err.sqlMessage?.includes('users_email_unique')) {
    return new HttpError(409, 'An account with that email already exists.', {
      email: 'An account with that email already exists.',
    });
  }
  return new HttpError(409, 'That username is already taken.', { username: 'That username is already taken.' });
}

// `login` is a username or an email; usernames can't contain '@', so that tells them apart.
export async function login({ login, password }) {
  const column = login.includes('@') ? 'email' : 'username';
  const row = await db('users').where(column, login).first('id', 'password_hash');
  const valid = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !valid) {
    throw new HttpError(401, 'Incorrect username/email or password.');
  }
  return createSession(await getUserById(row.id));
}

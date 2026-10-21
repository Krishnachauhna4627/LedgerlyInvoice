import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../config.js';
import { db } from '../../db.js';
import { HttpError } from '../../http-error.js';

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
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.sqlMessage?.includes('users_email_unique')) {
        throw new HttpError(409, 'An account with that email already exists.', {
          email: 'An account with that email already exists.',
        });
      }
      throw new HttpError(409, 'That username is already taken.', { username: 'That username is already taken.' });
    }
    throw err;
  }
  return createSession(await getUserById(userId));
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

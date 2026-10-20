import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../config.js';
import { db } from '../../db.js';
import { HttpError } from '../../http-error.js';

const BCRYPT_ROUNDS = 12;
// Compared against when the username doesn't exist, so response time doesn't reveal which usernames exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

function toPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    phone: row.phone,
    company: { id: row.company_id, name: row.company_name },
  };
}

export async function getUserById(id) {
  const row = await db('users')
    .join('companies', 'companies.id', 'users.company_id')
    .where('users.id', id)
    .first('users.id', 'users.name', 'users.username', 'users.phone', 'users.company_id', 'companies.name as company_name');
  return row ? toPublicUser(row) : null;
}

function createSession(user) {
  const token = jwt.sign({ sub: String(user.id) }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
  return { token, user };
}

export async function signup({ name, username, phone, company, password }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  let userId;
  try {
    userId = await db.transaction(async (trx) => {
      const [companyId] = await trx('companies').insert({ name: company });
      const [id] = await trx('users').insert({
        company_id: companyId,
        name,
        username,
        phone,
        password_hash: passwordHash,
      });
      return id;
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'That username is already taken.', { username: 'That username is already taken.' });
    }
    throw err;
  }
  return createSession(await getUserById(userId));
}

export async function login({ username, password }) {
  const row = await db('users').where({ username }).first('id', 'password_hash');
  const valid = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !valid) {
    throw new HttpError(401, 'Incorrect username or password.');
  }
  return createSession(await getUserById(row.id));
}

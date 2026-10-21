import bcrypt from 'bcryptjs';

// The super user. Safe to run more than once: an existing admin account is left as it is.
// Change this password after the first login on any shared or production database.
const ADMIN = { username: 'admin', password: 'admin123', name: 'Administrator', company: 'Ledgerly Admin' };

export async function seed(knex) {
  const existing = await knex('users').where({ username: ADMIN.username }).first('id', 'is_admin');
  if (existing) {
    if (!existing.is_admin) {
      // Never promote someone's own "admin" signup to super user.
      throw new Error(`A regular user named "${ADMIN.username}" already exists; rename it before seeding the admin.`);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN.password, 12);
  await knex.transaction(async (trx) => {
    // Every user belongs to a company, so the admin gets an empty one of its own.
    const [companyId] = await trx('companies').insert({ name: ADMIN.company });
    await trx('users').insert({
      company_id: companyId,
      name: ADMIN.name,
      username: ADMIN.username,
      phone: '0000000000',
      password_hash: passwordHash,
      is_admin: true,
    });
  });
}

// Super users who can view every user and their company data (see modules/admin).
export async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.boolean('is_admin').notNullable().defaultTo(false).after('password_hash');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('is_admin');
  });
}

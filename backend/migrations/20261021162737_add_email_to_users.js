// Email so users can log in with either their username or their email.
// Required at signup, but nullable here because accounts created before this have none.
export async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('email', 254).nullable().unique().after('username');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropUnique(['email']);
    table.dropColumn('email');
  });
}

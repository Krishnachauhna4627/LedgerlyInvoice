// What a customer owed (positive, Dr) or had paid in advance (negative, Cr) before their first invoice here.
// Skipped when the column exists (the PHP backend's copy of this migration may have added it).
export async function up(knex) {
  if (await knex.schema.hasColumn('clients', 'opening_balance')) return;
  await knex.schema.alterTable('clients', (table) => {
    table.decimal('opening_balance', 14, 2).notNullable().defaultTo(0).after('email');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('clients', (table) => {
    table.dropColumn('opening_balance');
  });
}

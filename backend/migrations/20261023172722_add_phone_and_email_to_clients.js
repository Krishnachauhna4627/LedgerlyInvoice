// Contact details for a client. Optional, so clients saved before this keep working.
export async function up(knex) {
  await knex.schema.alterTable('clients', (table) => {
    table.string('phone', 20).nullable().after('gstin');
    table.string('email', 254).nullable().after('phone');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('clients', (table) => {
    table.dropColumn('email');
    table.dropColumn('phone');
  });
}

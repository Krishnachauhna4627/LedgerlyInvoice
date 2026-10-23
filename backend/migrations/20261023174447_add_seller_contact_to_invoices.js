// Snapshot of the seller's phone and email on each invoice, like the other seller details.
export async function up(knex) {
  await knex.schema.alterTable('invoices', (table) => {
    table.string('seller_phone', 20).nullable().after('seller_gstin');
    table.string('seller_email', 254).nullable().after('seller_phone');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('invoices', (table) => {
    table.dropColumn('seller_email');
    table.dropColumn('seller_phone');
  });
}

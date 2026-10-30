// Money received from a customer (on account, not linked to one invoice). A customer with receipts
// can't be deleted, so their ledger never loses entries.
// Skipped when the table exists (the PHP backend's copy of this migration may have created it).
export async function up(knex) {
  if (await knex.schema.hasTable('receipts')) return;
  await knex.schema.createTable('receipts', (table) => {
    table.increments('id').primary();
    table
      .integer('company_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('companies')
      .onDelete('CASCADE');
    table.integer('client_id').unsigned().notNullable().references('id').inTable('clients');

    table.date('receipt_date').notNullable();
    table.enu('mode', ['cash', 'bank']).notNullable();
    table.decimal('amount', 14, 2).notNullable();
    table.string('reference', 100).nullable();

    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table
      .timestamp('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    table.index(['company_id', 'receipt_date']);
  });
}

export async function down(knex) {
  await knex.schema.dropTable('receipts');
}

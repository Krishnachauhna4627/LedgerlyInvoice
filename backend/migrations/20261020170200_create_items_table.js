// Saved products / services used to fill invoice lines.
export async function up(knex) {
  await knex.schema.createTable('items', (table) => {
    table.increments('id').primary();
    table
      .integer('company_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('companies')
      .onDelete('CASCADE');
    table.string('name', 200).notNullable();
    table.string('hsn_sac', 20).nullable();
    table.decimal('unit_price', 12, 2).notNullable().defaultTo(0);
    table.decimal('gst_rate', 5, 2).notNullable().defaultTo(18);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table
      .timestamp('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    table.index(['company_id', 'name']);
  });
}

export async function down(knex) {
  await knex.schema.dropTable('items');
}

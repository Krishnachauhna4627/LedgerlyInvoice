// Invoice lines. Item details are copied so editing the saved item never changes an invoice.
export async function up(knex) {
  await knex.schema.createTable('invoice_items', (table) => {
    table.increments('id').primary();
    table
      .integer('invoice_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('invoices')
      .onDelete('CASCADE');
    table
      .integer('item_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('items')
      .onDelete('SET NULL');
    table.integer('position').unsigned().notNullable();
    table.string('description', 200).notNullable();
    table.string('hsn_sac', 20).nullable();
    table.decimal('quantity', 12, 3).notNullable();
    table.decimal('unit_price', 12, 2).notNullable();
    table.decimal('gst_rate', 5, 2).notNullable();
    table.decimal('taxable_amount', 14, 2).notNullable();
    table.decimal('cgst', 14, 2).notNullable();
    table.decimal('sgst', 14, 2).notNullable();
    table.decimal('igst', 14, 2).notNullable();
    table.decimal('total_tax', 14, 2).notNullable();
    table.decimal('line_total', 14, 2).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table
      .timestamp('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  });
}

export async function down(knex) {
  await knex.schema.dropTable('invoice_items');
}

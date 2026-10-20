// Seller and client details are copied onto the invoice when it is saved, so later edits
// to the company or client never change an issued invoice.
export async function up(knex) {
  await knex.schema.createTable('invoices', (table) => {
    table.increments('id').primary();
    table
      .integer('company_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('companies')
      .onDelete('CASCADE');
    table
      .integer('client_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('clients')
      .onDelete('SET NULL');

    table.string('invoice_number', 40).notNullable();
    table.date('invoice_date').notNullable();
    table.date('due_date').nullable();
    table.enu('status', ['draft', 'unpaid', 'paid']).notNullable().defaultTo('unpaid');
    table.timestamp('paid_at').nullable();
    table.enu('template', ['classic', 'modern', 'minimal']).notNullable().defaultTo('classic');
    table.boolean('reverse_charge').notNullable().defaultTo(false);
    table.string('irn', 100).nullable();
    table.string('place_of_supply_code', 2).notNullable();
    table.boolean('is_inter_state').notNullable();

    table.string('seller_name', 150).notNullable();
    table.text('seller_address').nullable();
    table.string('seller_state_code', 2).notNullable();
    table.string('seller_gstin', 15).nullable();
    table.string('seller_bank_name', 100).nullable();
    table.string('seller_account_no', 34).nullable();
    table.string('seller_ifsc', 11).nullable();
    table.text('seller_terms').nullable();

    table.string('client_name', 150).notNullable();
    table.text('client_address').nullable();
    table.string('client_state_code', 2).notNullable();
    table.string('client_gstin', 15).nullable();

    table.decimal('sub_total', 14, 2).notNullable();
    table.decimal('total_cgst', 14, 2).notNullable();
    table.decimal('total_sgst', 14, 2).notNullable();
    table.decimal('total_igst', 14, 2).notNullable();
    table.decimal('total_tax', 14, 2).notNullable();
    table.decimal('grand_total', 14, 2).notNullable();

    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table
      .timestamp('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    table.unique(['company_id', 'invoice_number']);
    table.index(['company_id', 'invoice_date']);
  });
}

export async function down(knex) {
  await knex.schema.dropTable('invoices');
}

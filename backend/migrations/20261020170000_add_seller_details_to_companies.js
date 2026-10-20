// Seller (business) details printed on every invoice.
export async function up(knex) {
  await knex.schema.alterTable('companies', (table) => {
    table.text('address').nullable();
    table.string('state_code', 2).nullable();
    table.string('gstin', 15).nullable();
    table.string('bank_name', 100).nullable();
    table.string('account_no', 34).nullable();
    table.string('ifsc', 11).nullable();
    table.text('terms').nullable();
  });
}

export async function down(knex) {
  await knex.schema.alterTable('companies', (table) => {
    table.dropColumns('address', 'state_code', 'gstin', 'bank_name', 'account_no', 'ifsc', 'terms');
  });
}

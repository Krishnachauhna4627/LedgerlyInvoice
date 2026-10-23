// Seller contact details and a signature image, printed on invoices.
// The signature is a small PNG/JPEG stored as a data URL (resized in the browser before upload).
export async function up(knex) {
  await knex.schema.alterTable('companies', (table) => {
    table.string('phone', 20).nullable().after('gstin');
    table.string('email', 254).nullable().after('phone');
    table.mediumtext('signature').nullable().after('terms');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('companies', (table) => {
    table.dropColumn('signature');
    table.dropColumn('email');
    table.dropColumn('phone');
  });
}

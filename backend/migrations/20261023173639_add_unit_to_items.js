// Unit of measure for a saved item (e.g. PCS, KGS, GMS, SET). Optional; copied onto invoice lines.
export async function up(knex) {
  await knex.schema.alterTable('items', (table) => {
    table.string('unit', 10).nullable().after('hsn_sac');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('items', (table) => {
    table.dropColumn('unit');
  });
}

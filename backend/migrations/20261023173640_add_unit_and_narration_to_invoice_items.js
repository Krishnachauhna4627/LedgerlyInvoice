// Per-line unit of measure and a short narration shown under the item name (e.g. "Chain, 22K").
export async function up(knex) {
  await knex.schema.alterTable('invoice_items', (table) => {
    table.string('narration', 500).nullable().after('description');
    table.string('unit', 10).nullable().after('quantity');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('invoice_items', (table) => {
    table.dropColumn('unit');
    table.dropColumn('narration');
  });
}

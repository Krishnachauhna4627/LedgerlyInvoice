export async function up(knex) {
  await knex.schema.createTable('clients', (table) => {
    table.increments('id').primary();
    table
      .integer('company_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('companies')
      .onDelete('CASCADE');
    table.string('name', 150).notNullable();
    table.text('address').nullable();
    table.string('state_code', 2).notNullable();
    table.string('gstin', 15).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table
      .timestamp('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    table.index(['company_id', 'name']);
  });
}

export async function down(knex) {
  await knex.schema.dropTable('clients');
}

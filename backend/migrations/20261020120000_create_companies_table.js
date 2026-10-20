export async function up(knex) {
  await knex.schema.createTable('companies', (table) => {
    table.increments('id').primary();
    table.string('name', 150).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table
      .timestamp('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  });
}

export async function down(knex) {
  await knex.schema.dropTable('companies');
}

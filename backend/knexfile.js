import { config } from './src/config.js';

export default {
  client: 'mysql2',
  connection: config.db,
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
    loadExtensions: ['.js'],
    stub: './migrations/migration.stub',
  },
  seeds: {
    directory: './seeds',
  },
};

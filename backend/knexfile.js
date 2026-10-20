import { config } from './src/config.js';

export default {
  client: 'mysql2',
  // DECIMAL columns as numbers, DATE columns as 'YYYY-MM-DD' strings (no timezone shifts).
  connection: { ...config.db, decimalNumbers: true, dateStrings: ['DATE'] },
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

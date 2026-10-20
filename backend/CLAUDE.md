# Ledgerly Invoice — Backend Rules

Node (v24, see root `.nvmrc`) + Express 5, ES modules.

## Database migrations — one migration per table change

- **Every table gets a migration.** Never create or change a table by hand or with raw SQL outside a migration.
- One migration per change: creating a table, adding/removing a column, adding an index — each is its own migration file in `migrations/`.
- Migration files are named with a timestamp + description, e.g. `20261020120000_create_customers_table.js`, so they run in order.
- Every migration has both **up** (apply) and **down** (revert).
- **Never edit a migration that has already been run** (committed / shared). To change a table, write a new migration.
- Include primary key, foreign keys, `NOT NULL` / defaults, indexes, and `created_at` / `updated_at` timestamps in the create-table migration.
- Seed / sample data goes in `seeds/`, not in migrations.

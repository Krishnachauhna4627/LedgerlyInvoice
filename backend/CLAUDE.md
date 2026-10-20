# Ledgerly Invoice — Backend Rules

Node (v24, see root `.nvmrc`) + Express 5, ES modules, MySQL 8 via Knex.

## Structure

```
knexfile.js                 # DB connection + migration settings (reads src/config.js)
migrations/                 # one file per schema change; migration.stub is the template
seeds/                      # sample data
src/
  config.js                 # loads .env, validates required settings — use this, not process.env
  db.js                     # shared Knex instance
  http-error.js             # throw new HttpError(status, message, fieldErrors?)
  lib/gst.js                # GST states, GSTIN pattern, line/invoice tax maths (source of truth)
  lib/validation.js         # shared zod field helpers (requiredText, stateCode, gstin, money, …)
  middleware/               # validate (zod), require-auth (JWT → req.user), error-handler
  modules/<feature>/        # auth, company, clients, items, invoices, reports
  app.js  server.js
```

- Each feature lives in `src/modules/<feature>/`: routes stay thin, logic goes in the service, input rules in a zod schema applied with `validate(schema)`.
- Errors respond as `{ message, errors?: { field: message } }` — the frontend relies on this shape.
- Protected routes use `requireAuth`, which sets `req.user = { id, companyId }`. **Every query on business data is scoped by `req.user.companyId`** — look rows up with `where({ id, company_id })` and answer 404 if missing, never 403 (don't reveal other companies' ids).
- Invoices store snapshots of the seller and client (and line item details), plus totals calculated on the server with `lib/gst.js`. Never trust totals sent by the client.
- Money columns are `DECIMAL`, returned as numbers (`decimalNumbers`); `DATE` columns come back as `'YYYY-MM-DD'` strings (`dateStrings`), so compare dates as strings.
- Use `where(col, 'like', …)` for text search — knex's `whereLike` adds a collation MySQL rejects for utf8mb4.
- Never return `password_hash`; passwords are hashed with bcrypt.

## Commands

```bash
npm run dev                         # start with auto-restart
npm run migrate                     # apply all pending migrations
npm run migrate:rollback            # undo the last batch
npm run migrate:status              # list applied / pending
npm run migrate:make -- create_customers_table   # new migration from the stub
```

## Database migrations — one migration per table change

- **Every table gets a migration.** Never create or change a table by hand or with raw SQL outside a migration.
- One migration per change: creating a table, adding/removing a column, adding an index — each is its own migration file in `migrations/`.
- Migration files are named with a timestamp + description, e.g. `20261020120000_create_customers_table.js`, so they run in order.
- Every migration has both **up** (apply) and **down** (revert).
- **Never edit a migration that has already been run** (committed / shared). To change a table, write a new migration.
- Include primary key, foreign keys, `NOT NULL` / defaults, indexes, and `created_at` / `updated_at` timestamps in the create-table migration.
- Seed / sample data goes in `seeds/`, not in migrations.
- Create new migrations with `npm run migrate:make -- <name>` so they use the ES-module stub.

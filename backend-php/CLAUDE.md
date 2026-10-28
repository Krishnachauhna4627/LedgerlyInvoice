# Ledgerly Invoice — PHP Backend Rules

PHP 8.1+ (keep it 8.1-compatible: shared hosting), CodeIgniter 4, MySQL via the Query Builder.
Port of `../backend` (Node); the API (URLs, JSON shapes, status codes, messages) must stay identical,
because the frontend is shared.

## Structure

```
app/Config/Routes.php            # every /api route
app/Config/Validation.php        # rule groups per form (signup, seller, client, item, invoice, …) + messages
app/Config/Filters.php           # 'auth' (JWT) and 'admin' filters, CORS on api/*
app/Controllers/BaseController.php  # body(), validated() (clean → validate → 400), id(), json(), noContent()
app/Controllers/Api/<Module>.php # one controller per module; thin
app/Libraries/                   # AuthService, InvoiceService, Gst (tax maths), Mailer, JsonExceptionHandler
app/Models/                      # one model per table; toDto()/toRow() map snake_case ↔ camelCase
app/Validation/LedgerlyRules.php # custom rules (state_code, gstin, unit, js_number, …)
app/Database/Migrations/         # schema (one migration per change)
database/schema.sql              # phpMyAdmin import for hosts without SSH (regenerate after schema changes)
```

## Rules

- Errors respond as `{ message, errors?: { field: message } }`: throw `App\Exceptions\HttpError(status, message, fieldErrors?)`.
- Input: `$this->validated('<group>', CLEANERS)`. Cleaners do the zod-style transforms (trim, lower/upper,
  `empty_to_null`, `number` coercion, `default:<json>`); rules and messages live in `Config\Validation`.
- Protected routes use the `auth` filter; `service('currentUser')` has `id`, `companyId`, `isAdmin`.
  **Every query on business data is scoped by `companyId`**. Look rows up by `id` + `company_id` and answer 404
  if missing, never 403.
- Invoices store snapshots of the seller and client, plus totals calculated on the server with `Gst`.
  Never trust totals sent by the client. Keep `Gst` in step with `frontend/src/app/core/gst/`.
- JSON types: cast DECIMAL columns with `(float)`, booleans with `(bool)`; TIMESTAMPs go through `iso_timestamp()`.
- Never return `password_hash`; passwords are bcrypt (`password_hash` / `password_verify`).

## Database migrations — one migration per table change

- Every table change is a migration in `app/Database/Migrations/` (`php spark make:migration <Name>`), never manual SQL.
- One migration per change, with both `up()` and `down()`; never edit a migration that has already run.
- Use the `MigrationHelpers` trait for column types, set `'null'` explicitly, and name indexes/foreign keys
  `<table>_<columns>_<unique|index|foreign>`.
- After changing the schema, regenerate `database/schema.sql` (export structure + `migrations` rows from a freshly migrated database).

## Commands

```bash
php spark serve --port 8080     # dev server
php spark migrate               # apply pending migrations
php spark migrate:rollback      # undo the last batch
php spark migrate:status
php spark db:seed AdminSeeder   # super user admin / admin123
php spark routes                # list routes and their filters
```

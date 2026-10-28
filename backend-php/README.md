# Ledgerly Invoice — PHP backend (CodeIgniter 4)

The complete backend in PHP, for hosting where Node isn't available (e.g. cPanel shared hosting).
It is a port of the Node backend in `../backend`: **same URLs, same JSON, same database**, so the
Angular frontend works unchanged. Logins and password hashes work on both backends.

Requires PHP 8.1+ with `intl`, `mbstring` and `mysqli`; MySQL 5.7+ / 8 or MariaDB 10.3+.

## Run locally

```bash
composer install
cp .env.example .env            # fill in DB_* and JWT_SECRET
php spark migrate               # create the tables (skips any that already exist)
php spark db:seed AdminSeeder   # optional: super user admin / admin123 — change the password!
php spark serve --port 8080
```

Point the frontend at it: in `frontend/proxy.conf.json` set `"target": "http://localhost:8080"`.

## Deploy to shared hosting (cPanel)

1. **Build locally** (shared hosts usually have no Composer):
   ```bash
   composer install --no-dev --optimize-autoloader
   ```
2. **Database**: in cPanel → *MySQL Databases*, create a database and user, and give the user all
   privileges on it. Then either:
   - with SSH: run `php spark migrate` on the server, or
   - without SSH: open phpMyAdmin, select the empty database, *Import* → `database/schema.sql`.
3. **Upload** the whole `backend-php` folder (including `vendor/`) **outside** `public_html`,
   e.g. `/home/<user>/ledgerly-api/`.
4. **Point a subdomain at `public/`**: cPanel → *Domains* → create e.g. `api.yourdomain.com` with
   document root `/home/<user>/ledgerly-api/public`.
   *If your host only lets the document root be the project folder itself*, that works too:
   the root `.htaccess` sends everything into `public/` and blocks `app/`, `vendor/`, `writable/` and `.env`.
5. **PHP version**: cPanel → *Select PHP Version* → 8.1 or newer, with `intl`, `mbstring`, `mysqli` enabled.
6. **`.env`** on the server (copy `.env.example`):
   ```ini
   CI_ENVIRONMENT = production
   app.baseURL = 'https://api.yourdomain.com/'
   CORS_ORIGIN=https://your-frontend.vercel.app
   DB_HOST=localhost
   DB_NAME=cpaneluser_ledgerly
   DB_USER=cpaneluser_ledgerly
   DB_PASSWORD=...
   JWT_SECRET=...        # php -r "echo bin2hex(random_bytes(48)), PHP_EOL;"
   SMTP_HOST=mail.yourdomain.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=no-reply@yourdomain.com
   SMTP_PASS=...
   MAIL_FROM=Gogna <no-reply@yourdomain.com>
   ```
   Keep the same `JWT_SECRET` as the Node backend if both run against one database.
7. **Permissions**: `writable/` (and its sub-folders) must be writable by PHP (usually 755 is enough on cPanel).
8. **Check**: open `https://api.yourdomain.com/api/health` → `{"status":"ok"}`.
9. **Frontend**: in `frontend/vercel.json`, set the `/api/:path*` rewrite destination to
   `https://api.yourdomain.com/api/:path*` and redeploy.
10. **Admin user** (optional): sign up in the app, then in phpMyAdmin run
    `UPDATE users SET is_admin = 1 WHERE username = 'yourname';` (or `php spark db:seed AdminSeeder` with SSH).

**Troubleshooting**
- *Every API call says "Please log in."*: the host strips the `Authorization` header. Both `.htaccess`
  files pass it through; make sure they were uploaded (they're hidden files).
- *PUT / PATCH / DELETE return 403 or 405*: ask the host to allow these methods (ModSecurity rule) for the API subdomain.
- *500 errors*: see `writable/logs/log-<date>.log`.

## API

| Module | Routes |
|---|---|
| health | `GET /api/health` |
| auth | `POST signup, login, forgot-password` · `GET/PUT me` · `PUT me/password` |
| company | `GET/PUT /api/company` · `PUT/DELETE /api/company/signature` |
| clients | `GET/POST /api/clients` · `GET/PUT/DELETE /api/clients/:id` |
| items | `GET/POST /api/items` · `PUT/DELETE /api/items/:id` |
| invoices | `GET/POST /api/invoices` · `GET count, next-number` · `GET/PUT/DELETE /:id` · `PATCH /:id/status` |
| reports | `GET dashboard, sales, sales/export` |
| admin (super users) | `GET users, users/:id, invoices/:id` |

## Compatibility with the Node backend

- **Logins**: HS256 JWTs with `sub` = user id (string), signed with `JWT_SECRET`, so tokens work on both.
- **Passwords**: bcrypt; PHP's `password_verify` accepts bcryptjs hashes and bcryptjs accepts PHP's.
- **Errors**: always `{ message, errors?: { field: message } }`, with the same messages as the Node zod schemas.
- **Numbers / dates**: DECIMAL columns are JSON numbers, DATE columns `'YYYY-MM-DD'`, TIMESTAMPs ISO strings
  (`2026-10-28T11:50:00.000Z`). "Today" uses `app.appTimezone` (default Asia/Kolkata).
- **Totals**: `App\Libraries\Gst` rounds exactly like `backend/src/lib/gst.js`.
- **Schema**: the migrations create the same tables, columns and index names as the knex migrations, and
  skip anything that already exists, so `php spark migrate` is safe on a database the Node app created.

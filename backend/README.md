# Backend setup

1. Copy `.env.example` to `.env` and set `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and a private `JWT_SECRET`.
2. Make sure the MySQL server is running and the configured database and user exist.
3. Install dependencies with `npm install`, then run `npm run migrate` to create the tables.
4. Start the API with `npm run dev`.

The backend loads `.env` from this directory. Keep `.env` private; only `.env.example` belongs in version control.

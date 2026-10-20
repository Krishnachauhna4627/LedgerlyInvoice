import app from './app.js';
import { config } from './config.js';
import { db } from './db.js';

// Fail fast with a clear message instead of answering every request with a 500.
try {
  await db.raw('select 1');
} catch (err) {
  console.error(
    `Cannot connect to MySQL as '${config.db.user}' on ${config.db.host}:${config.db.port}/${config.db.database}: ${err.message}\n` +
      'Check the DB_* settings in backend/.env.',
  );
  process.exit(1);
}

app.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});

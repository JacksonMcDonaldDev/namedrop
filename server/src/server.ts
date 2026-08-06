import app from './app';
import { runMigrations } from './migrate';

const PORT = process.env.PORT || 3001;

async function waitForDb(retries = 10, delayMs = 2000) {
  const pool = (await import('./db')).default;
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch {
      console.log(`Waiting for database... (${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('Database not available after retries');
}

async function start() {
  await waitForDb();
  await runMigrations();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch(console.error);

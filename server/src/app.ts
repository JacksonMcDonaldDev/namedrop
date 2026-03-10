import express from 'express';
import cors from 'cors';
import path from 'path';
import { runMigrations } from './migrate';
import { router } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(requestLogger);
app.use(cors());
app.use(express.json());

// Static file serving for photos
app.use('/uploads/photos', express.static(path.join(__dirname, '..', 'uploads', 'photos')));

// API routes
app.use('/api', router);

// Error handler
app.use(errorHandler);

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

export default app;

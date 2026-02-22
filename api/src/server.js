import express from 'express';
import cors from 'cors';
import ordersRouter from './routes/orders.js';
import resourcesRouter from './routes/resources.js';
import { initializeDatabase, pool } from './db.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (_error) {
    res.status(503).json({ status: 'error' });
  }
});

app.use('/api/orders', ordersRouter);
app.use('/api', resourcesRouter);

app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Erro interno do servidor';

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({ error: message });
});

const start = async () => {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`[api] running on port ${PORT}`);
  });
};

start().catch((error) => {
  console.error('[api] startup failed', error);
  process.exit(1);
});

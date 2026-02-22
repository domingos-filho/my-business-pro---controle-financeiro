import pg from 'pg';

const { Pool } = pg;

const TABLES = ['customers', 'products', 'orders', 'transactions', 'categories'];

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for API startup.');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const toEntity = (row) => ({
  id: row.id,
  ...(row.data || {}),
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
  deletedAt: row.deleted_at === null ? null : Number(row.deleted_at),
  syncStatus: row.sync_status,
});

export const rowToEntity = toEntity;

const stripMeta = (payload = {}) => {
  const data = { ...payload };
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;
  delete data.deletedAt;
  delete data.syncStatus;
  return data;
};

export const sanitizePayload = stripMeta;

const createTableSql = (table) => `
  CREATE TABLE IF NOT EXISTS ${table} (
    id SERIAL PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted_at BIGINT NULL,
    sync_status TEXT NOT NULL DEFAULT 'PENDING'
  );
`;

const createIndexesSql = (table) => [
  `CREATE INDEX IF NOT EXISTS ${table}_deleted_at_idx ON ${table} (deleted_at);`,
  `CREATE INDEX IF NOT EXISTS ${table}_updated_at_idx ON ${table} (updated_at);`,
  `CREATE INDEX IF NOT EXISTS ${table}_sync_status_idx ON ${table} (sync_status);`,
];

const ensureSchema = async () => {
  const client = await pool.connect();
  try {
    for (const table of TABLES) {
      await client.query(createTableSql(table));
      for (const stmt of createIndexesSql(table)) {
        await client.query(stmt);
      }
    }
  } finally {
    client.release();
  }
};

export const initializeDatabase = async (maxAttempts = 30, delayMs = 2000) => {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      await ensureSchema();
      return;
    } catch (error) {
      lastError = error;
      console.error(`[db] connection attempt ${attempt}/${maxAttempts} failed`);
      if (attempt < maxAttempts) {
        await sleep(delayMs);
      }
    }
  }

  throw lastError || new Error('Unable to connect to database.');
};

export const RESOURCE_TABLES = TABLES.reduce((acc, table) => {
  acc[table] = table;
  return acc;
}, {});

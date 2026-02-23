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

const createUsersTableSql = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT NULL,
    provider TEXT NOT NULL DEFAULT 'email',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    last_login_at BIGINT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
  );
`;

const createUserIndexesSql = [
  'CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (lower(email));',
  'CREATE INDEX IF NOT EXISTS users_is_active_idx ON users (is_active);',
];

const createSessionsTableSql = `
  CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    user_agent TEXT NULL,
    ip_address TEXT NULL,
    expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL,
    revoked_at BIGINT NULL
  );
`;

const createSessionIndexesSql = [
  'CREATE UNIQUE INDEX IF NOT EXISTS sessions_refresh_token_hash_unique_idx ON sessions (refresh_token_hash);',
  'CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);',
  'CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);',
];

const createIndexesSql = (table) => [
  `CREATE INDEX IF NOT EXISTS ${table}_deleted_at_idx ON ${table} (deleted_at);`,
  `CREATE INDEX IF NOT EXISTS ${table}_updated_at_idx ON ${table} (updated_at);`,
  `CREATE INDEX IF NOT EXISTS ${table}_sync_status_idx ON ${table} (sync_status);`,
];

const createUserColumnSql = (table) => `
  ALTER TABLE ${table}
  ADD COLUMN IF NOT EXISTS user_id INTEGER NULL;
`;

const createUserScopedIndexesSql = (table) => [
  `CREATE INDEX IF NOT EXISTS ${table}_user_id_idx ON ${table} (user_id);`,
  `CREATE INDEX IF NOT EXISTS ${table}_user_id_deleted_at_idx ON ${table} (user_id, deleted_at);`,
  `CREATE INDEX IF NOT EXISTS ${table}_user_id_updated_at_idx ON ${table} (user_id, updated_at);`,
];

const createUserForeignKeySql = (table) => `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = '${table}_user_id_fkey'
  ) THEN
    ALTER TABLE ${table}
    ADD CONSTRAINT ${table}_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END
$$;
`;

const ensureSchema = async () => {
  const client = await pool.connect();
  try {
    await client.query(createUsersTableSql);
    for (const stmt of createUserIndexesSql) {
      await client.query(stmt);
    }

    await client.query(createSessionsTableSql);
    for (const stmt of createSessionIndexesSql) {
      await client.query(stmt);
    }

    for (const table of TABLES) {
      await client.query(createTableSql(table));
      await client.query(createUserColumnSql(table));
      await client.query(createUserForeignKeySql(table));

      for (const stmt of createIndexesSql(table)) {
        await client.query(stmt);
      }

      for (const stmt of createUserScopedIndexesSql(table)) {
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

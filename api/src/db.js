import pg from 'pg';

const { Pool } = pg;

const TABLES = ['customers', 'products', 'orders', 'transactions', 'categories'];
const DEFAULT_SYSTEM_CATEGORIES = [
  { name: 'Vendas', type: 'INCOME', color: '#4F46E5' },
  { name: 'Outras Receitas', type: 'INCOME', color: '#10B981' },
  { name: 'Materia-prima', type: 'EXPENSE', color: '#F59E0B' },
  { name: 'Embalagens', type: 'EXPENSE', color: '#EC4899' },
  { name: 'Frete', type: 'EXPENSE', color: '#3B82F6' },
  { name: 'Marketing', type: 'EXPENSE', color: '#8B5CF6' },
  { name: 'Operacional', type: 'EXPENSE', color: '#06B6D4' },
  { name: 'Impostos e Taxas', type: 'EXPENSE', color: '#F43F5E' },
];

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for API startup.');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const toEntity = (row) => {
  const data = { ...(row.data || {}) };
  delete data.isSystem;
  delete data.ownerUserId;

  const entity = {
    id: row.id,
    ...data,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at === null ? null : Number(row.deleted_at),
    syncStatus: row.sync_status,
  };

  if (Object.prototype.hasOwnProperty.call(row, 'is_system')) {
    entity.isSystem = Boolean(row.is_system);
  }

  return entity;
};

export const rowToEntity = toEntity;

const stripMeta = (payload = {}) => {
  const data = { ...payload };
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;
  delete data.deletedAt;
  delete data.syncStatus;
  delete data.isSystem;
  delete data.ownerUserId;
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
  'CREATE INDEX IF NOT EXISTS users_locked_until_idx ON users (locked_until);',
];

const ensureUserSecurityColumnsSql = [
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS password_updated_at BIGINT NULL;',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until BIGINT NULL;',
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

const createPasswordResetTokensTableSql = `
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL,
    used_at BIGINT NULL,
    requested_ip TEXT NULL,
    requested_user_agent TEXT NULL
  );
`;

const createPasswordResetTokenIndexesSql = [
  'CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_token_hash_unique_idx ON password_reset_tokens (token_hash);',
  'CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens (user_id);',
  'CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx ON password_reset_tokens (expires_at);',
];

const createAiProductAnalysesTableSql = `
  CREATE TABLE IF NOT EXISTS ai_product_analyses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  );
`;

const createAiProductAnalysesIndexesSql = [
  'CREATE UNIQUE INDEX IF NOT EXISTS ai_product_analyses_user_product_unique_idx ON ai_product_analyses (user_id, product_id);',
  'CREATE INDEX IF NOT EXISTS ai_product_analyses_user_id_idx ON ai_product_analyses (user_id);',
  'CREATE INDEX IF NOT EXISTS ai_product_analyses_product_id_idx ON ai_product_analyses (product_id);',
  'CREATE INDEX IF NOT EXISTS ai_product_analyses_updated_at_idx ON ai_product_analyses (updated_at);',
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

const createCategorySystemColumnSql = `
  ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;
`;

const createCategorySystemIndexesSql = [
  'CREATE INDEX IF NOT EXISTS categories_is_system_idx ON categories (is_system);',
  'CREATE INDEX IF NOT EXISTS categories_is_system_deleted_at_idx ON categories (is_system, deleted_at);',
  `CREATE UNIQUE INDEX IF NOT EXISTS categories_system_name_type_unique_idx
   ON categories ((lower(coalesce(data->>'name', ''))), (coalesce(data->>'type', '')))
   WHERE is_system = TRUE;`,
];

const seedSystemCategories = async (client) => {
  const now = Date.now();

  for (const category of DEFAULT_SYSTEM_CATEGORIES) {
    const existing = await client.query(
      `SELECT id
       FROM categories
       WHERE is_system = TRUE
         AND lower(coalesce(data->>'name', '')) = lower($1)
         AND coalesce(data->>'type', '') = $2
       LIMIT 1`,
      [category.name, category.type]
    );

    if (existing.rowCount) {
      await client.query(
        `UPDATE categories
         SET data = $2::jsonb,
             user_id = NULL,
             is_system = TRUE,
             deleted_at = NULL,
             updated_at = $3,
             sync_status = 'SYNCED'
         WHERE id = $1`,
        [existing.rows[0].id, category, now]
      );
      continue;
    }

    await client.query(
      `INSERT INTO categories (data, created_at, updated_at, deleted_at, sync_status, user_id, is_system)
       VALUES ($1, $2, $2, NULL, 'SYNCED', NULL, TRUE)`,
      [category, now]
    );
  }
};

const ensureSchema = async () => {
  const client = await pool.connect();
  try {
    await client.query(createUsersTableSql);
    for (const stmt of ensureUserSecurityColumnsSql) {
      await client.query(stmt);
    }
    for (const stmt of createUserIndexesSql) {
      await client.query(stmt);
    }

    await client.query(createSessionsTableSql);
    for (const stmt of createSessionIndexesSql) {
      await client.query(stmt);
    }

    await client.query(createPasswordResetTokensTableSql);
    for (const stmt of createPasswordResetTokenIndexesSql) {
      await client.query(stmt);
    }

    await client.query(createAiProductAnalysesTableSql);
    for (const stmt of createAiProductAnalysesIndexesSql) {
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

    await client.query(createCategorySystemColumnSql);
    for (const stmt of createCategorySystemIndexesSql) {
      await client.query(stmt);
    }
    await seedSystemCategories(client);
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

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
  'CREATE INDEX IF NOT EXISTS users_is_admin_idx ON users (is_admin);',
  'CREATE INDEX IF NOT EXISTS users_locked_until_idx ON users (locked_until);',
  'CREATE INDEX IF NOT EXISTS users_access_status_idx ON users (access_status);',
  'CREATE INDEX IF NOT EXISTS users_access_mode_idx ON users (access_mode);',
  'CREATE INDEX IF NOT EXISTS users_trial_ends_at_idx ON users (trial_ends_at);',
  'CREATE INDEX IF NOT EXISTS users_access_expires_at_idx ON users (access_expires_at);',
];

const ensureUserSecurityColumnsSql = [
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS password_updated_at BIGINT NULL;',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until BIGINT NULL;',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;',
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS access_status TEXT NOT NULL DEFAULT 'ACTIVE';",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS access_mode TEXT NOT NULL DEFAULT 'OPEN_REGISTRATION';",
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at BIGINT NULL;',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS access_expires_at BIGINT NULL;',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at BIGINT NULL;',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by INTEGER NULL;',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at BIGINT NULL;',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT NULL;',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS cancelled_at BIGINT NULL;',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS last_access_check_at BIGINT NULL;',
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

const createUserAccessLogsTableSql = `
  CREATE TABLE IF NOT EXISTS user_access_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
    event TEXT NOT NULL,
    previous_status TEXT NULL,
    new_status TEXT NULL,
    reason TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at BIGINT NOT NULL
  );
`;

const createUserAccessLogsIndexesSql = [
  'CREATE INDEX IF NOT EXISTS user_access_logs_user_id_idx ON user_access_logs (user_id);',
  'CREATE INDEX IF NOT EXISTS user_access_logs_actor_user_id_idx ON user_access_logs (actor_user_id);',
  'CREATE INDEX IF NOT EXISTS user_access_logs_created_at_idx ON user_access_logs (created_at);',
];

const createInvitesTableSql = `
  CREATE TABLE IF NOT EXISTS invites (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    access_status TEXT NOT NULL,
    access_mode TEXT NOT NULL,
    trial_days INTEGER NULL,
    expires_at BIGINT NOT NULL,
    used_at BIGINT NULL,
    revoked_at BIGINT NULL,
    created_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
    used_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  );
`;

const createInviteIndexesSql = [
  'CREATE UNIQUE INDEX IF NOT EXISTS invites_token_hash_unique_idx ON invites (token_hash);',
  'CREATE INDEX IF NOT EXISTS invites_email_idx ON invites (lower(email));',
  'CREATE INDEX IF NOT EXISTS invites_expires_at_idx ON invites (expires_at);',
  'CREATE INDEX IF NOT EXISTS invites_used_at_idx ON invites (used_at);',
  'CREATE INDEX IF NOT EXISTS invites_revoked_at_idx ON invites (revoked_at);',
  'CREATE INDEX IF NOT EXISTS invites_created_by_idx ON invites (created_by);',
];

const createPlansTableSql = `
  CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    price_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'BRL',
    billing_interval TEXT NOT NULL DEFAULT 'MONTH',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  );
`;

const createPlanIndexesSql = [
  'CREATE UNIQUE INDEX IF NOT EXISTS plans_code_unique_idx ON plans (lower(code));',
  'CREATE INDEX IF NOT EXISTS plans_is_active_idx ON plans (is_active);',
  'CREATE INDEX IF NOT EXISTS plans_billing_interval_idx ON plans (billing_interval);',
];

const createSubscriptionsTableSql = `
  CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
    status TEXT NOT NULL,
    current_period_start BIGINT NULL,
    current_period_end BIGINT NULL,
    cancelled_at BIGINT NULL,
    gateway TEXT NULL,
    gateway_customer_id TEXT NULL,
    gateway_subscription_id TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  );
`;

const createSubscriptionIndexesSql = [
  'CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions (user_id);',
  'CREATE INDEX IF NOT EXISTS subscriptions_plan_id_idx ON subscriptions (plan_id);',
  'CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions (status);',
  'CREATE INDEX IF NOT EXISTS subscriptions_current_period_end_idx ON subscriptions (current_period_end);',
  'CREATE INDEX IF NOT EXISTS subscriptions_gateway_subscription_id_idx ON subscriptions (gateway_subscription_id);',
  `CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_gateway_unique_idx
   ON subscriptions (gateway, gateway_subscription_id)
   WHERE gateway IS NOT NULL AND gateway_subscription_id IS NOT NULL;`,
];

const createPaymentEventsTableSql = `
  CREATE TABLE IF NOT EXISTS payment_events (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER NULL REFERENCES subscriptions(id) ON DELETE SET NULL,
    user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
    gateway TEXT NOT NULL,
    event_type TEXT NOT NULL,
    external_event_id TEXT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed_at BIGINT NULL,
    created_at BIGINT NOT NULL
  );
`;

const createPaymentEventIndexesSql = [
  'CREATE INDEX IF NOT EXISTS payment_events_subscription_id_idx ON payment_events (subscription_id);',
  'CREATE INDEX IF NOT EXISTS payment_events_user_id_idx ON payment_events (user_id);',
  'CREATE INDEX IF NOT EXISTS payment_events_gateway_idx ON payment_events (gateway);',
  'CREATE INDEX IF NOT EXISTS payment_events_event_type_idx ON payment_events (event_type);',
  'CREATE INDEX IF NOT EXISTS payment_events_created_at_idx ON payment_events (created_at);',
  `CREATE UNIQUE INDEX IF NOT EXISTS payment_events_external_unique_idx
   ON payment_events (gateway, external_event_id)
   WHERE external_event_id IS NOT NULL;`,
];

const DEFAULT_PLANS = [
  {
    code: 'starter',
    name: 'Starter',
    description: 'Plano base para uso comercial manual antes da integracao com gateway.',
    priceCents: 0,
    currency: 'BRL',
    billingInterval: 'MONTH',
  },
  {
    code: 'professional',
    name: 'Profissional',
    description: 'Plano principal para clientes ativos.',
    priceCents: 0,
    currency: 'BRL',
    billingInterval: 'MONTH',
  },
];

const adminEmails = String(process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

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

const seedDefaultPlans = async (client) => {
  const now = Date.now();

  for (const plan of DEFAULT_PLANS) {
    await client.query(
      `INSERT INTO plans (
         code,
         name,
         description,
         price_cents,
         currency,
         billing_interval,
         is_active,
         features,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, '{}'::jsonb, $7, $7)
       ON CONFLICT ((lower(code))) DO UPDATE
       SET name = EXCLUDED.name,
           description = COALESCE(plans.description, EXCLUDED.description),
           updated_at = EXCLUDED.updated_at`,
      [
        plan.code,
        plan.name,
        plan.description,
        plan.priceCents,
        plan.currency,
        plan.billingInterval,
        now,
      ],
    );
  }
};

const ensureAdminEmails = async (client) => {
  if (!adminEmails.length) {
    return;
  }

  const now = Date.now();
  await client.query(
    `UPDATE users
     SET is_admin = TRUE,
         access_status = 'ACTIVE',
         approved_at = COALESCE(approved_at, $2),
         updated_at = $2
     WHERE lower(email) = ANY($1::text[])`,
    [adminEmails, now]
  );
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

    await client.query(createUserAccessLogsTableSql);
    for (const stmt of createUserAccessLogsIndexesSql) {
      await client.query(stmt);
    }

    await client.query(createInvitesTableSql);
    for (const stmt of createInviteIndexesSql) {
      await client.query(stmt);
    }

    await client.query(createPlansTableSql);
    for (const stmt of createPlanIndexesSql) {
      await client.query(stmt);
    }

    await client.query(createSubscriptionsTableSql);
    for (const stmt of createSubscriptionIndexesSql) {
      await client.query(stmt);
    }

    await client.query(createPaymentEventsTableSql);
    for (const stmt of createPaymentEventIndexesSql) {
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
    await ensureAdminEmails(client);
    await seedDefaultPlans(client);
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

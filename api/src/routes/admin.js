import express from 'express';
import {
  ACCESS_MODE,
  ACCESS_STATUS,
  DEFAULT_INVITE_EXPIRES_DAYS,
  DEFAULT_TRIAL_DAYS,
  REGISTRATION_ACCESS_MODE,
  REGISTRATION_ACCESS_STATUS,
  TRIAL_DAY_OPTIONS,
  USER_ACCESS_SELECT_FIELDS,
  evaluateAccess,
  normalizeAccessMode,
  normalizeAccessStatus,
  toPublicAccessMetadata,
} from '../access.js';
import { pool } from '../db.js';
import { createInviteToken, hashInviteToken } from '../invites.js';
import {
  BILLING_INTERVAL,
  DEFAULT_SUBSCRIPTION_PERIOD_DAYS,
  SUBSCRIPTION_PERIOD_OPTIONS,
  SUBSCRIPTION_STATUS,
  isSubscriptionAccessAllowed,
  normalizeBillingInterval,
  normalizeSubscriptionStatus,
  subscriptionStatusToAccessMode,
  subscriptionStatusToAccessStatus,
} from '../subscriptions.js';

const router = express.Router();

const mutableStatuses = new Set([
  ACCESS_STATUS.PENDING,
  ACCESS_STATUS.TRIAL,
  ACCESS_STATUS.ACTIVE,
  ACCESS_STATUS.PAST_DUE,
  ACCESS_STATUS.SUSPENDED,
  ACCESS_STATUS.CANCELLED,
  ACCESS_STATUS.EXPIRED,
]);

const toPositiveTimestamp = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
};

const toPositiveDays = (value, fallback = DEFAULT_TRIAL_DAYS) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
};

const inviteStatuses = new Set([ACCESS_STATUS.PENDING, ACCESS_STATUS.TRIAL, ACCESS_STATUS.ACTIVE]);
const subscriptionStatuses = new Set(Object.values(SUBSCRIPTION_STATUS));
const billingIntervals = new Set(Object.values(BILLING_INTERVAL));
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const normalizePlanCode = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

const toNonNegativeCents = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
};

const buildAdminUser = (row) => {
  const access = evaluateAccess(row);

  return {
    id: Number(row.id),
    email: row.email,
    name: row.name,
    avatar: row.avatar || null,
    provider: row.provider || 'email',
    emailVerified: Boolean(row.email_verified),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    lastLoginAt: row.last_login_at === null ? null : Number(row.last_login_at),
    isActive: Boolean(row.is_active),
    ...toPublicAccessMetadata(row),
    effectiveAccessAllowed: access.allowed,
    effectiveAccessCode: access.code,
  };
};

const buildInvite = (row) => {
  const now = Date.now();
  const usedAt = row.used_at === null ? null : Number(row.used_at);
  const revokedAt = row.revoked_at === null ? null : Number(row.revoked_at);
  const expiresAt = Number(row.expires_at);

  return {
    id: Number(row.id),
    email: row.email,
    accessStatus: normalizeAccessStatus(row.access_status),
    accessMode: normalizeAccessMode(row.access_mode),
    trialDays: row.trial_days === null ? null : Number(row.trial_days),
    expiresAt,
    usedAt,
    revokedAt,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    createdBy: row.created_by === null ? null : Number(row.created_by),
    usedBy: row.used_by === null ? null : Number(row.used_by),
    active: !usedAt && !revokedAt && expiresAt > now,
    createdByEmail: row.created_by_email || null,
    usedByEmail: row.used_by_email || null,
  };
};

const buildPlan = (row) => ({
  id: Number(row.id),
  code: row.code,
  name: row.name,
  description: row.description || null,
  priceCents: Number(row.price_cents || 0),
  currency: row.currency || 'BRL',
  billingInterval: normalizeBillingInterval(row.billing_interval),
  isActive: Boolean(row.is_active),
  features: row.features || {},
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
});

const buildSubscription = (row) => ({
  id: Number(row.id),
  userId: Number(row.user_id),
  planId: Number(row.plan_id),
  status: normalizeSubscriptionStatus(row.status),
  currentPeriodStart: row.current_period_start === null ? null : Number(row.current_period_start),
  currentPeriodEnd: row.current_period_end === null ? null : Number(row.current_period_end),
  cancelledAt: row.cancelled_at === null ? null : Number(row.cancelled_at),
  gateway: row.gateway || null,
  gatewayCustomerId: row.gateway_customer_id || null,
  gatewaySubscriptionId: row.gateway_subscription_id || null,
  metadata: row.metadata || {},
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
  userEmail: row.user_email || null,
  userName: row.user_name || null,
  planCode: row.plan_code || null,
  planName: row.plan_name || null,
  planPriceCents: row.plan_price_cents === null || row.plan_price_cents === undefined
    ? null
    : Number(row.plan_price_cents),
  planCurrency: row.plan_currency || null,
  planBillingInterval: row.plan_billing_interval
    ? normalizeBillingInterval(row.plan_billing_interval)
    : null,
});

const writeAccessLog = async (
  client,
  { userId, actorUserId, event, previousStatus, newStatus, reason = null, metadata = {} },
) => {
  await client.query(
    `INSERT INTO user_access_logs (
       user_id,
       actor_user_id,
       event,
       previous_status,
       new_status,
       reason,
       metadata,
       created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
    [userId, actorUserId, event, previousStatus, newStatus, reason, JSON.stringify(metadata || {}), Date.now()],
  );
};

const syncUserAccessFromSubscription = async (
  client,
  { userRow, subscriptionRow, actorUserId, reason = null },
) => {
  const now = Date.now();
  const subscriptionStatus = normalizeSubscriptionStatus(subscriptionRow.status);
  const nextStatus = subscriptionStatusToAccessStatus(subscriptionStatus);
  const nextMode = subscriptionStatusToAccessMode(subscriptionStatus);
  const previousStatus = normalizeAccessStatus(userRow.access_status);
  const periodEnd =
    subscriptionRow.current_period_end === null ? null : Number(subscriptionRow.current_period_end);
  const accessAllowed = isSubscriptionAccessAllowed(subscriptionStatus);
  const trialEndsAt = nextStatus === ACCESS_STATUS.TRIAL ? periodEnd : null;
  const accessExpiresAt = nextStatus === ACCESS_STATUS.ACTIVE ? periodEnd : null;
  const approvedAt = accessAllowed ? userRow.approved_at || now : userRow.approved_at;
  const cancelledAt = nextStatus === ACCESS_STATUS.CANCELLED ? userRow.cancelled_at || now : null;

  const updateResult = await client.query(
    `UPDATE users
     SET access_status = $2,
         access_mode = $3,
         trial_ends_at = $4,
         access_expires_at = $5,
         approved_at = $6,
         approved_by = $7,
         suspended_at = NULL,
         suspension_reason = NULL,
         cancelled_at = $8,
         updated_at = $9
     WHERE id = $1
     RETURNING ${USER_ACCESS_SELECT_FIELDS}, created_at, updated_at, last_login_at`,
    [
      userRow.id,
      nextStatus,
      nextMode,
      trialEndsAt,
      accessExpiresAt,
      approvedAt,
      actorUserId,
      cancelledAt,
      now,
    ],
  );

  if (!accessAllowed) {
    await client.query(
      `UPDATE sessions
       SET revoked_at = $2
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [userRow.id, now],
    );
  }

  await writeAccessLog(client, {
    userId: userRow.id,
    actorUserId,
    event: 'SUBSCRIPTION_STATUS_SYNCED',
    previousStatus,
    newStatus: nextStatus,
    reason,
    metadata: {
      subscriptionId: Number(subscriptionRow.id),
      planId: Number(subscriptionRow.plan_id),
      subscriptionStatus,
      currentPeriodEnd: periodEnd,
    },
  });

  return updateResult.rows[0];
};

router.get('/settings', (_req, res) => {
  return res.json({
    defaultTrialDays: DEFAULT_TRIAL_DAYS,
    trialDayOptions: TRIAL_DAY_OPTIONS,
    defaultInviteExpiresDays: DEFAULT_INVITE_EXPIRES_DAYS,
    defaultSubscriptionPeriodDays: DEFAULT_SUBSCRIPTION_PERIOD_DAYS,
    subscriptionPeriodOptions: SUBSCRIPTION_PERIOD_OPTIONS,
    registrationAccessStatus: REGISTRATION_ACCESS_STATUS,
    registrationAccessMode: REGISTRATION_ACCESS_MODE,
  });
});

router.get('/plans', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM plans
       ORDER BY is_active DESC, created_at DESC`,
    );

    return res.json(result.rows.map(buildPlan));
  } catch (error) {
    return next(error);
  }
});

router.post('/plans', async (req, res, next) => {
  const name = String(req.body?.name || '').trim();
  const code = normalizePlanCode(req.body?.code || name);
  const description = String(req.body?.description || '').trim() || null;
  const priceCents = toNonNegativeCents(req.body?.priceCents);
  const currency = String(req.body?.currency || 'BRL').trim().toUpperCase().slice(0, 3) || 'BRL';
  const billingInterval = normalizeBillingInterval(req.body?.billingInterval);

  if (!name || !code) {
    return res.status(400).json({ error: 'Nome e codigo do plano sao obrigatorios.' });
  }

  if (priceCents === null) {
    return res.status(400).json({ error: 'Valor do plano invalido.' });
  }

  if (!billingIntervals.has(billingInterval)) {
    return res.status(400).json({ error: 'Intervalo de cobranca invalido.' });
  }

  try {
    const now = Date.now();
    const result = await pool.query(
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
       RETURNING *`,
      [code, name, description, priceCents, currency, billingInterval, now],
    );

    return res.status(201).json(buildPlan(result.rows[0]));
  } catch (error) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Ja existe um plano com este codigo.' });
    }
    return next(error);
  }
});

router.get('/subscriptions', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         s.*,
         u.email AS user_email,
         u.name AS user_name,
         p.code AS plan_code,
         p.name AS plan_name,
         p.price_cents AS plan_price_cents,
         p.currency AS plan_currency,
         p.billing_interval AS plan_billing_interval
       FROM subscriptions s
       JOIN users u ON u.id = s.user_id
       JOIN plans p ON p.id = s.plan_id
       ORDER BY s.created_at DESC
       LIMIT 100`,
    );

    return res.json(result.rows.map(buildSubscription));
  } catch (error) {
    return next(error);
  }
});

router.get('/invites', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         i.id,
         i.email,
         i.access_status,
         i.access_mode,
         i.trial_days,
         i.expires_at,
         i.used_at,
         i.revoked_at,
         i.created_by,
         i.used_by,
         i.created_at,
         i.updated_at,
         c.email AS created_by_email,
         u.email AS used_by_email
       FROM invites i
       LEFT JOIN users c ON c.id = i.created_by
       LEFT JOIN users u ON u.id = i.used_by
       ORDER BY i.created_at DESC
       LIMIT 100`
    );

    return res.json(result.rows.map(buildInvite));
  } catch (error) {
    return next(error);
  }
});

router.post('/invites', async (req, res, next) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!validEmail(email)) {
    return res.status(400).json({ error: 'E-mail de convite invalido' });
  }

  const accessStatus = normalizeAccessStatus(req.body?.accessStatus, ACCESS_STATUS.TRIAL);
  if (!inviteStatuses.has(accessStatus)) {
    return res.status(400).json({ error: 'Status inicial do convite invalido' });
  }

  const trialDays = accessStatus === ACCESS_STATUS.TRIAL ? toPositiveDays(req.body?.trialDays) : null;
  const expiresInDays = toPositiveDays(req.body?.expiresInDays, DEFAULT_INVITE_EXPIRES_DAYS);
  const token = createInviteToken();
  const tokenHash = hashInviteToken(token);
  const now = Date.now();
  const expiresAt = now + expiresInDays * 24 * 60 * 60 * 1000;
  const accessMode = ACCESS_MODE.INVITE;

  try {
    const result = await pool.query(
      `INSERT INTO invites (
         email,
         token_hash,
         access_status,
         access_mode,
         trial_days,
         expires_at,
         used_at,
         revoked_at,
         created_by,
         used_by,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, $7, NULL, $8, $8)
       RETURNING *`,
      [email, tokenHash, accessStatus, accessMode, trialDays, expiresAt, req.user.id, now],
    );

    return res.status(201).json({
      ...buildInvite(result.rows[0]),
      token,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/invites/:inviteId/revoke', async (req, res, next) => {
  const inviteId = Number(req.params.inviteId);
  if (!Number.isInteger(inviteId) || inviteId <= 0) {
    return res.status(400).json({ error: 'Convite invalido' });
  }

  try {
    const now = Date.now();
    const result = await pool.query(
      `UPDATE invites
       SET revoked_at = COALESCE(revoked_at, $2),
           updated_at = $2
       WHERE id = $1
       RETURNING *`,
      [inviteId, now],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Convite nao encontrado' });
    }

    return res.json(buildInvite(result.rows[0]));
  } catch (error) {
    return next(error);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const statusFilter = String(req.query.status || '').trim().toUpperCase();
    const search = String(req.query.search || '').trim().toLowerCase();

    const result = await pool.query(
      `SELECT ${USER_ACCESS_SELECT_FIELDS}, created_at, updated_at, last_login_at
       FROM users
       ORDER BY created_at DESC`
    );

    let items = result.rows;

    if (statusFilter) {
      items = items.filter((row) => normalizeAccessStatus(row.access_status) === statusFilter);
    }

    if (search) {
      items = items.filter((row) =>
        row.email.toLowerCase().includes(search) || row.name.toLowerCase().includes(search),
      );
    }

    const mapped = items.map(buildAdminUser);
    const counts = result.rows.reduce(
      (acc, row) => {
        const status = normalizeAccessStatus(row.access_status);
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      {},
    );

    return res.json({
      summary: {
        total: result.rows.length,
        filtered: mapped.length,
        byStatus: counts,
      },
      items: mapped,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/users/:userId/access', async (req, res, next) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Usuario invalido' });
  }

  const nextStatus = normalizeAccessStatus(req.body?.accessStatus, '');
  if (!mutableStatuses.has(nextStatus)) {
    return res.status(400).json({ error: 'Status de acesso invalido' });
  }

  const reason = String(req.body?.reason || '').trim() || null;
  const requestedMode = req.body?.accessMode
    ? normalizeAccessMode(req.body.accessMode)
    : null;
  const requestedTrialEndsAt = toPositiveTimestamp(req.body?.trialEndsAt);
  const trialDays = toPositiveDays(req.body?.trialDays);
  const accessExpiresAt = toPositiveTimestamp(req.body?.accessExpiresAt);

  if (userId === req.user.id && nextStatus === ACCESS_STATUS.SUSPENDED) {
    return res.status(409).json({ error: 'Nao e permitido suspender a propria conta.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const currentResult = await client.query(
      `SELECT ${USER_ACCESS_SELECT_FIELDS}
       FROM users
       WHERE id = $1
       LIMIT 1
       FOR UPDATE`,
      [userId],
    );

    if (!currentResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }

    const currentUser = currentResult.rows[0];
    const previousStatus = normalizeAccessStatus(currentUser.access_status);
    const now = Date.now();

    const trialEndsAt =
      nextStatus === ACCESS_STATUS.TRIAL
        ? requestedTrialEndsAt || now + trialDays * 24 * 60 * 60 * 1000
        : null;

    if (nextStatus === ACCESS_STATUS.TRIAL && trialEndsAt <= now) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A data de termino do trial precisa estar no futuro.' });
    }

    const nextMode =
      nextStatus === ACCESS_STATUS.TRIAL
        ? ACCESS_MODE.TRIAL
        : requestedMode || currentUser.access_mode;
    const approvedAt =
      nextStatus === ACCESS_STATUS.ACTIVE || nextStatus === ACCESS_STATUS.TRIAL
        ? currentUser.approved_at || now
        : currentUser.approved_at;
    const suspendedAt = nextStatus === ACCESS_STATUS.SUSPENDED ? now : null;
    const cancelledAt = nextStatus === ACCESS_STATUS.CANCELLED ? now : null;

    const updateResult = await client.query(
      `UPDATE users
       SET access_status = $2,
           access_mode = $3,
           trial_ends_at = $4,
           access_expires_at = $5,
           approved_at = $6,
           approved_by = $7,
           suspended_at = $8,
           suspension_reason = $9,
           cancelled_at = $10,
           updated_at = $11
       WHERE id = $1
       RETURNING ${USER_ACCESS_SELECT_FIELDS}, created_at, updated_at, last_login_at`,
      [
        userId,
        nextStatus,
        nextMode,
        trialEndsAt,
        accessExpiresAt,
        approvedAt,
        req.user.id,
        suspendedAt,
        nextStatus === ACCESS_STATUS.SUSPENDED ? reason : null,
        cancelledAt,
        now,
      ],
    );

    if (nextStatus !== ACCESS_STATUS.ACTIVE && nextStatus !== ACCESS_STATUS.TRIAL) {
      await client.query(
        `UPDATE sessions
         SET revoked_at = $2
         WHERE user_id = $1
           AND revoked_at IS NULL`,
        [userId, now],
      );
    }

    await writeAccessLog(client, {
      userId,
      actorUserId: req.user.id,
      event: 'ACCESS_STATUS_UPDATED',
      previousStatus,
      newStatus: nextStatus,
      reason,
      metadata: {
        accessMode: nextMode,
        trialEndsAt,
        trialDays: nextStatus === ACCESS_STATUS.TRIAL ? trialDays : null,
        accessExpiresAt,
      },
    });

    await client.query('COMMIT');
    return res.json(buildAdminUser(updateResult.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.post('/users/:userId/subscription', async (req, res, next) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Usuario invalido' });
  }

  const planId = Number(req.body?.planId);
  if (!Number.isInteger(planId) || planId <= 0) {
    return res.status(400).json({ error: 'Plano invalido' });
  }

  const status = normalizeSubscriptionStatus(req.body?.status, SUBSCRIPTION_STATUS.ACTIVE);
  if (!subscriptionStatuses.has(status)) {
    return res.status(400).json({ error: 'Status de assinatura invalido.' });
  }

  const periodDays = toPositiveDays(req.body?.periodDays, DEFAULT_SUBSCRIPTION_PERIOD_DAYS);
  const now = Date.now();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT ${USER_ACCESS_SELECT_FIELDS}
       FROM users
       WHERE id = $1
       LIMIT 1
       FOR UPDATE`,
      [userId],
    );

    if (!userResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }

    const planResult = await client.query(
      `SELECT *
       FROM plans
       WHERE id = $1
         AND is_active = TRUE
       LIMIT 1`,
      [planId],
    );

    if (!planResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Plano ativo nao encontrado.' });
    }

    const plan = planResult.rows[0];
    const billingInterval = normalizeBillingInterval(plan.billing_interval);
    const renewsAccess = [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING].includes(status);
    const currentPeriodEnd =
      !renewsAccess
        ? null
        : billingInterval === BILLING_INTERVAL.LIFETIME && status === SUBSCRIPTION_STATUS.ACTIVE
        ? null
        : now + periodDays * 24 * 60 * 60 * 1000;
    const cancelledAt = status === SUBSCRIPTION_STATUS.CANCELLED ? now : null;

    if (
      renewsAccess &&
      currentPeriodEnd !== null &&
      currentPeriodEnd <= now
    ) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A assinatura precisa terminar no futuro.' });
    }

    const subscriptionResult = await client.query(
      `INSERT INTO subscriptions (
         user_id,
         plan_id,
         status,
         current_period_start,
         current_period_end,
         cancelled_at,
         gateway,
         gateway_customer_id,
         gateway_subscription_id,
         metadata,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'manual', NULL, NULL, $7::jsonb, $4, $4)
       RETURNING *`,
      [
        userId,
        planId,
        status,
        now,
        currentPeriodEnd,
        cancelledAt,
        JSON.stringify({
          source: 'admin_manual',
          periodDays,
        }),
      ],
    );

    await syncUserAccessFromSubscription(client, {
      userRow: userResult.rows[0],
      subscriptionRow: subscriptionResult.rows[0],
      actorUserId: req.user.id,
      reason: `Assinatura ${status.toLowerCase()} criada manualmente`,
    });

    const responseResult = await client.query(
      `SELECT
         s.*,
         u.email AS user_email,
         u.name AS user_name,
         p.code AS plan_code,
         p.name AS plan_name,
         p.price_cents AS plan_price_cents,
         p.currency AS plan_currency,
         p.billing_interval AS plan_billing_interval
       FROM subscriptions s
       JOIN users u ON u.id = s.user_id
       JOIN plans p ON p.id = s.plan_id
       WHERE s.id = $1
       LIMIT 1`,
      [subscriptionResult.rows[0].id],
    );

    await client.query('COMMIT');
    return res.status(201).json(buildSubscription(responseResult.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.patch('/subscriptions/:subscriptionId', async (req, res, next) => {
  const subscriptionId = Number(req.params.subscriptionId);
  if (!Number.isInteger(subscriptionId) || subscriptionId <= 0) {
    return res.status(400).json({ error: 'Assinatura invalida' });
  }

  const status = normalizeSubscriptionStatus(req.body?.status, '');
  if (!subscriptionStatuses.has(status)) {
    return res.status(400).json({ error: 'Status de assinatura invalido.' });
  }

  const periodDays = toPositiveDays(req.body?.periodDays, DEFAULT_SUBSCRIPTION_PERIOD_DAYS);
  const now = Date.now();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const currentSubscriptionResult = await client.query(
      `SELECT s.*, p.billing_interval
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.id = $1
       LIMIT 1
       FOR UPDATE`,
      [subscriptionId],
    );

    if (!currentSubscriptionResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Assinatura nao encontrada.' });
    }

    const currentSubscription = currentSubscriptionResult.rows[0];
    const userResult = await client.query(
      `SELECT ${USER_ACCESS_SELECT_FIELDS}
       FROM users
       WHERE id = $1
       LIMIT 1
       FOR UPDATE`,
      [currentSubscription.user_id],
    );

    if (!userResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuario da assinatura nao encontrado.' });
    }

    const billingInterval = normalizeBillingInterval(currentSubscription.billing_interval);
    const renewsAccess = [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING].includes(status);
    const currentPeriodEnd =
      !renewsAccess
        ? currentSubscription.current_period_end
        : billingInterval === BILLING_INTERVAL.LIFETIME && status === SUBSCRIPTION_STATUS.ACTIVE
          ? null
          : now + periodDays * 24 * 60 * 60 * 1000;
    const currentPeriodStart = renewsAccess ? now : currentSubscription.current_period_start;
    const cancelledAt = status === SUBSCRIPTION_STATUS.CANCELLED ? now : null;

    const updateResult = await client.query(
      `UPDATE subscriptions
       SET status = $2,
           current_period_start = $3,
           current_period_end = $4,
           cancelled_at = $5,
           metadata = metadata || $6::jsonb,
           updated_at = $7
       WHERE id = $1
       RETURNING *`,
      [
        subscriptionId,
        status,
        currentPeriodStart,
        currentPeriodEnd,
        cancelledAt,
        JSON.stringify({
          lastAdminUpdate: {
            actorUserId: req.user.id,
            periodDays: renewsAccess ? periodDays : null,
            at: now,
          },
        }),
        now,
      ],
    );

    await syncUserAccessFromSubscription(client, {
      userRow: userResult.rows[0],
      subscriptionRow: updateResult.rows[0],
      actorUserId: req.user.id,
      reason: `Assinatura alterada para ${status.toLowerCase()}`,
    });

    const responseResult = await client.query(
      `SELECT
         s.*,
         u.email AS user_email,
         u.name AS user_name,
         p.code AS plan_code,
         p.name AS plan_name,
         p.price_cents AS plan_price_cents,
         p.currency AS plan_currency,
         p.billing_interval AS plan_billing_interval
       FROM subscriptions s
       JOIN users u ON u.id = s.user_id
       JOIN plans p ON p.id = s.plan_id
       WHERE s.id = $1
       LIMIT 1`,
      [subscriptionId],
    );

    await client.query('COMMIT');
    return res.json(buildSubscription(responseResult.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.get('/logs', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         l.id,
         l.user_id,
         l.actor_user_id,
         l.event,
         l.previous_status,
         l.new_status,
         l.reason,
         l.metadata,
         l.created_at,
         u.email AS user_email,
         u.name AS user_name,
         a.email AS actor_email,
         a.name AS actor_name
       FROM user_access_logs l
       JOIN users u ON u.id = l.user_id
       LEFT JOIN users a ON a.id = l.actor_user_id
       ORDER BY l.created_at DESC
       LIMIT 100`
    );

    return res.json(
      result.rows.map((row) => ({
        id: Number(row.id),
        userId: Number(row.user_id),
        actorUserId: row.actor_user_id === null ? null : Number(row.actor_user_id),
        event: row.event,
        previousStatus: row.previous_status,
        newStatus: row.new_status,
        reason: row.reason,
        metadata: row.metadata || {},
        createdAt: Number(row.created_at),
        userEmail: row.user_email,
        userName: row.user_name,
        actorEmail: row.actor_email,
        actorName: row.actor_name,
      })),
    );
  } catch (error) {
    return next(error);
  }
});

export default router;

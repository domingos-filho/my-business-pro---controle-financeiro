import express from 'express';
import {
  ACCESS_MODE,
  ACCESS_STATUS,
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

const router = express.Router();

const mutableStatuses = new Set([
  ACCESS_STATUS.PENDING,
  ACCESS_STATUS.TRIAL,
  ACCESS_STATUS.ACTIVE,
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

router.get('/settings', (_req, res) => {
  return res.json({
    defaultTrialDays: DEFAULT_TRIAL_DAYS,
    trialDayOptions: TRIAL_DAY_OPTIONS,
    registrationAccessStatus: REGISTRATION_ACCESS_STATUS,
    registrationAccessMode: REGISTRATION_ACCESS_MODE,
  });
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

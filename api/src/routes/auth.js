import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { createRateLimit } from '../middleware/rateLimit.js';

const router = express.Router();

const ACCESS_COOKIE_NAME = 'mbp_access_token';
const REFRESH_COOKIE_NAME = 'mbp_refresh_token';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!ACCESS_SECRET) {
  throw new Error('JWT_ACCESS_SECRET is required for API startup.');
}

if (!REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET is required for API startup.');
}

const parseBool = (value, fallback) => {
  if (typeof value !== 'string') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
};

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
};

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const ACCESS_TOKEN_MAX_AGE_MS = toPositiveInt(process.env.ACCESS_TOKEN_MAX_AGE_MS, 15 * 60 * 1000);
const REFRESH_TOKEN_TTL_DAYS = toPositiveInt(process.env.REFRESH_TOKEN_TTL_DAYS, 30);
const REFRESH_TOKEN_MAX_AGE_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const COOKIE_SECURE = parseBool(process.env.AUTH_COOKIE_SECURE, process.env.NODE_ENV === 'production');
const COOKIE_SAME_SITE = process.env.AUTH_COOKIE_SAME_SITE || 'lax';
const ENABLE_SOCIAL_LOGIN = parseBool(process.env.ENABLE_SOCIAL_LOGIN, false);
const PASSWORD_RESET_SECRET = process.env.PASSWORD_RESET_SECRET || REFRESH_SECRET;
const PASSWORD_RESET_TOKEN_TTL_MINUTES = toPositiveInt(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES, 30);
const PASSWORD_RESET_TOKEN_TTL_MS = PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000;
const AUTH_EXPOSE_RESET_TOKEN = parseBool(
  process.env.AUTH_EXPOSE_RESET_TOKEN,
  process.env.NODE_ENV !== 'production'
);
const MAX_FAILED_LOGIN_ATTEMPTS = toPositiveInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS, 5);
const LOGIN_LOCKOUT_MINUTES = toPositiveInt(process.env.LOGIN_LOCKOUT_MINUTES, 15);
const LOGIN_LOCKOUT_MS = LOGIN_LOCKOUT_MINUTES * 60 * 1000;
const MAX_ACTIVE_SESSIONS = toPositiveInt(process.env.MAX_ACTIVE_SESSIONS, 10);
const ALLOW_LEGACY_DATA_CLAIM = parseBool(process.env.ALLOW_LEGACY_DATA_CLAIM, false);

const LEGACY_TABLES = ['customers', 'products', 'orders', 'transactions', 'categories'];

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeName = (value) => String(value || '').trim();
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const buildDefaultAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`;

const toPublicUser = (row) => ({
  id: Number(row.id),
  email: row.email,
  name: row.name,
  avatar: row.avatar || null,
  provider: row.provider || 'email',
  emailVerified: Boolean(row.email_verified),
});

const authCookieOptions = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: COOKIE_SAME_SITE,
  path: '/',
};

const hashRefreshToken = (token) =>
  crypto.createHmac('sha256', REFRESH_SECRET).update(token).digest('hex');

const hashPasswordResetToken = (token) =>
  crypto.createHmac('sha256', PASSWORD_RESET_SECRET).update(token).digest('hex');

const buildAccessToken = (user) =>
  jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      name: user.name,
      provider: user.provider || 'email',
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

const setAuthCookies = (res, { accessToken, refreshToken }) => {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    ...authCookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...authCookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
};

const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE_NAME, authCookieOptions);
  res.clearCookie(REFRESH_COOKIE_NAME, authCookieOptions);
};

const getPasswordValidationErrors = (password) => {
  const errors = [];

  if (typeof password !== 'string' || password.length < 10) {
    errors.push('ter pelo menos 10 caracteres');
  }
  if (!/[a-z]/.test(password || '')) {
    errors.push('conter ao menos uma letra minuscula');
  }
  if (!/[A-Z]/.test(password || '')) {
    errors.push('conter ao menos uma letra maiuscula');
  }
  if (!/\d/.test(password || '')) {
    errors.push('conter ao menos um numero');
  }

  return errors;
};

const validatePassword = (password) => getPasswordValidationErrors(password).length === 0;
const buildPasswordValidationMessage = (password) => {
  const errors = getPasswordValidationErrors(password);
  if (!errors.length) return null;
  return `A senha precisa ${errors.join(', ')}.`;
};

const buildLockoutMessage = (lockedUntil) => {
  const remainingSeconds = Math.max(1, Math.ceil((Number(lockedUntil) - Date.now()) / 1000));
  const remainingMinutes = Math.ceil(remainingSeconds / 60);
  return `Conta temporariamente bloqueada. Tente novamente em cerca de ${remainingMinutes} minuto(s).`;
};

const authKeyByIpAndEmail = (req) => {
  const email = normalizeEmail(req.body?.email) || 'anonymous';
  return `${req.ip || 'unknown'}:${email}`;
};

const loginRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyFn: authKeyByIpAndEmail,
  message: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
});

const registerRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  keyFn: authKeyByIpAndEmail,
  message: 'Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.',
});

const refreshRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'Muitas renovacoes de sessao. Aguarde alguns instantes.',
});

const socialRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'Muitas tentativas de login social. Aguarde alguns minutos e tente novamente.',
});

const passwordResetRateLimit = createRateLimit({
  windowMs: 30 * 60 * 1000,
  maxRequests: 5,
  keyFn: authKeyByIpAndEmail,
  message: 'Muitas solicitacoes de redefinicao. Aguarde alguns minutos e tente novamente.',
});

const revokeUserSessions = async (client, userId, revokedAt, excludeSessionId = null) => {
  if (excludeSessionId) {
    await client.query(
      `UPDATE sessions
       SET revoked_at = $3
       WHERE user_id = $1
         AND revoked_at IS NULL
         AND id <> $2`,
      [userId, excludeSessionId, revokedAt]
    );
    return;
  }

  await client.query(
    `UPDATE sessions
     SET revoked_at = $2
     WHERE user_id = $1
       AND revoked_at IS NULL`,
    [userId, revokedAt]
  );
};

const revokeExcessSessions = async (client, userId, revokedAt) => {
  const staleSessions = await client.query(
    `SELECT id
     FROM sessions
     WHERE user_id = $1
       AND revoked_at IS NULL
     ORDER BY created_at DESC
     OFFSET $2`,
    [userId, MAX_ACTIVE_SESSIONS]
  );

  if (!staleSessions.rowCount) {
    return;
  }

  const staleIds = staleSessions.rows.map((row) => Number(row.id)).filter(Boolean);
  if (!staleIds.length) {
    return;
  }

  await client.query(
    `UPDATE sessions
     SET revoked_at = $2
     WHERE id = ANY($1::int[])`,
    [staleIds, revokedAt]
  );
};

const createSession = async (client, userId, req) => {
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const now = Date.now();
  const expiresAt = now + REFRESH_TOKEN_MAX_AGE_MS;

  await client.query(
    `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at, created_at, revoked_at)
     VALUES ($1, $2, $3, $4, $5, $6, NULL)`,
    [userId, refreshTokenHash, req.get('user-agent') || null, req.ip || null, expiresAt, now]
  );

  await revokeExcessSessions(client, userId, now);
  return refreshToken;
};

const issueAuthSession = async (client, user, req, res) => {
  const accessToken = buildAccessToken(user);
  const refreshToken = await createSession(client, user.id, req);
  setAuthCookies(res, { accessToken, refreshToken });
};

const registerFailedLoginAttempt = async (client, user) => {
  const now = Date.now();
  const attempts = Number(user.failed_login_attempts || 0) + 1;
  const lockedUntil = attempts >= MAX_FAILED_LOGIN_ATTEMPTS ? now + LOGIN_LOCKOUT_MS : null;

  await client.query(
    `UPDATE users
     SET failed_login_attempts = $2,
         locked_until = $3,
         updated_at = $4
     WHERE id = $1`,
    [user.id, attempts, lockedUntil, now]
  );

  return lockedUntil;
};

const resetFailedLoginState = async (client, userId, now) => {
  await client.query(
    `UPDATE users
     SET failed_login_attempts = 0,
         locked_until = NULL,
         last_login_at = $2,
         updated_at = $2
     WHERE id = $1`,
    [userId, now]
  );
};

const createPasswordResetToken = async (client, userId, req) => {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashPasswordResetToken(token);
  const now = Date.now();
  const expiresAt = now + PASSWORD_RESET_TOKEN_TTL_MS;

  await client.query(
    `UPDATE password_reset_tokens
     SET used_at = $2
     WHERE user_id = $1
       AND used_at IS NULL`,
    [userId, now]
  );

  await client.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at, used_at, requested_ip, requested_user_agent)
     VALUES ($1, $2, $3, $4, NULL, $5, $6)`,
    [userId, tokenHash, expiresAt, now, req.ip || null, req.get('user-agent') || null]
  );

  return token;
};

const markPasswordResetTokensUsed = async (client, userId, usedAt) => {
  await client.query(
    `UPDATE password_reset_tokens
     SET used_at = $2
     WHERE user_id = $1
       AND used_at IS NULL`,
    [userId, usedAt]
  );
};

const getLegacySummary = async (client) => {
  const perTable = {};
  let totalLegacyRecords = 0;
  let totalScopedRecords = 0;

  for (const table of LEGACY_TABLES) {
    const legacyResult = await client.query(
      `SELECT COUNT(*)::int AS legacy_count
       FROM ${table}
       WHERE user_id IS NULL`
    );
    const scopedResult = await client.query(
      `SELECT COUNT(*)::int AS scoped_count
       FROM ${table}
       WHERE user_id IS NOT NULL`
    );

    const legacyCount = Number(legacyResult.rows[0]?.legacy_count || 0);
    const scopedCount = Number(scopedResult.rows[0]?.scoped_count || 0);
    perTable[table] = legacyCount;
    totalLegacyRecords += legacyCount;
    totalScopedRecords += scopedCount;
  }

  return {
    perTable,
    totalLegacyRecords,
    totalScopedRecords,
  };
};

router.post('/register', registerRateLimit, async (req, res, next) => {
  const email = normalizeEmail(req.body?.email);
  const name = normalizeName(req.body?.name);
  const password = String(req.body?.password || '');

  if (!name || name.length < 2 || !validEmail(email)) {
    return res.status(400).json({ error: 'Dados de cadastro invalidos' });
  }

  const passwordMessage = buildPasswordValidationMessage(password);
  if (passwordMessage) {
    return res.status(400).json({ error: passwordMessage });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const now = Date.now();
    const passwordHash = await bcrypt.hash(password, 12);
    const avatar = buildDefaultAvatar(name);
    const created = await client.query(
      `INSERT INTO users (
         email, password_hash, name, avatar, provider, created_at, updated_at, last_login_at,
         is_active, email_verified, password_updated_at, failed_login_attempts, locked_until
       )
       VALUES ($1, $2, $3, $4, 'email', $5, $5, $5, TRUE, FALSE, $5, 0, NULL)
       RETURNING id, email, name, avatar, provider, email_verified`,
      [email, passwordHash, name, avatar, now]
    );

    const user = created.rows[0];
    await issueAuthSession(client, user, req, res);
    await client.query('COMMIT');

    return res.status(201).json(toPublicUser(user));
  } catch (error) {
    await client.query('ROLLBACK');
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'E-mail ja cadastrado' });
    }
    return next(error);
  } finally {
    client.release();
  }
});

router.post('/login', loginRateLimit, async (req, res, next) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');

  if (!validEmail(email) || !password) {
    return res.status(400).json({ error: 'Credenciais invalidas' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT
         id, email, password_hash, name, avatar, provider, email_verified,
         failed_login_attempts, locked_until
       FROM users
       WHERE lower(email) = lower($1)
         AND is_active = TRUE
       LIMIT 1
       FOR UPDATE`,
      [email]
    );

    if (!userResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'E-mail ou senha invalidos' });
    }

    const user = userResult.rows[0];
    const now = Date.now();

    if (user.locked_until && Number(user.locked_until) > now) {
      await client.query('ROLLBACK');
      return res.status(423).json({ error: buildLockoutMessage(user.locked_until) });
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);

    if (!passwordOk) {
      const lockedUntil = await registerFailedLoginAttempt(client, user);
      await client.query('COMMIT');
      if (lockedUntil) {
        return res.status(423).json({ error: buildLockoutMessage(lockedUntil) });
      }
      return res.status(401).json({ error: 'E-mail ou senha invalidos' });
    }

    await resetFailedLoginState(client, user.id, now);
    await issueAuthSession(client, user, req, res);
    await client.query('COMMIT');

    return res.json(toPublicUser(user));
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.post('/social', socialRateLimit, async (req, res, next) => {
  if (!ENABLE_SOCIAL_LOGIN) {
    return res.status(501).json({ error: 'Login social indisponivel no momento' });
  }

  const provider = req.body?.provider;
  if (provider !== 'google' && provider !== 'apple') {
    return res.status(400).json({ error: 'Provedor social invalido' });
  }

  const email = `${provider}@exemplo.com`;
  const name = provider === 'google' ? 'Google User' : 'Apple User';
  const avatar =
    provider === 'google'
      ? 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png'
      : 'https://cdn-icons-png.flaticon.com/512/0/747.png';

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let userResult = await client.query(
      `SELECT id, email, name, avatar, provider, email_verified
       FROM users
       WHERE lower(email) = lower($1)
         AND is_active = TRUE
       LIMIT 1
       FOR UPDATE`,
      [email]
    );

    if (!userResult.rowCount) {
      const now = Date.now();
      const randomPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
      userResult = await client.query(
        `INSERT INTO users (
           email, password_hash, name, avatar, provider, created_at, updated_at, last_login_at,
           is_active, email_verified, password_updated_at, failed_login_attempts, locked_until
         )
         VALUES ($1, $2, $3, $4, $5, $6, $6, $6, TRUE, TRUE, $6, 0, NULL)
         RETURNING id, email, name, avatar, provider, email_verified`,
        [email, randomPasswordHash, name, avatar, provider, now]
      );
    } else {
      const now = Date.now();
      await client.query(
        `UPDATE users
         SET last_login_at = $2,
             updated_at = $2,
             failed_login_attempts = 0,
             locked_until = NULL
         WHERE id = $1`,
        [userResult.rows[0].id, now]
      );
    }

    const user = userResult.rows[0];
    await issueAuthSession(client, user, req, res);
    await client.query('COMMIT');

    return res.json(toPublicUser(user));
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.post('/refresh', refreshRateLimit, async (req, res, next) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!refreshToken) {
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Sessao expirada' });
  }

  const refreshTokenHash = hashRefreshToken(refreshToken);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const now = Date.now();
    const sessionResult = await client.query(
      `SELECT
         s.id AS session_id,
         s.user_id,
         u.email,
         u.name,
         u.avatar,
         u.provider,
         u.email_verified,
         u.is_active
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.refresh_token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > $2
         AND u.is_active = TRUE
       LIMIT 1
       FOR UPDATE`,
      [refreshTokenHash, now]
    );

    if (!sessionResult.rowCount) {
      await client.query('ROLLBACK');
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Sessao expirada' });
    }

    const session = sessionResult.rows[0];
    const user = {
      id: Number(session.user_id),
      email: session.email,
      name: session.name,
      avatar: session.avatar,
      provider: session.provider,
      email_verified: session.email_verified,
    };

    await client.query(
      `UPDATE sessions
       SET revoked_at = $2
       WHERE id = $1`,
      [session.session_id, now]
    );

    await issueAuthSession(client, user, req, res);
    await client.query('COMMIT');

    return res.json(toPublicUser(user));
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.post('/request-password-reset', passwordResetRateLimit, async (req, res, next) => {
  const email = normalizeEmail(req.body?.email);

  if (!validEmail(email)) {
    return res.status(200).json({
      success: true,
      message: 'Se o e-mail existir, enviaremos instrucoes de redefinicao.',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT id
       FROM users
       WHERE lower(email) = lower($1)
         AND is_active = TRUE
       LIMIT 1
       FOR UPDATE`,
      [email]
    );

    let debugResetToken;
    if (userResult.rowCount) {
      debugResetToken = await createPasswordResetToken(client, userResult.rows[0].id, req);
    }

    await client.query('COMMIT');

    const response = {
      success: true,
      message: 'Se o e-mail existir, enviaremos instrucoes de redefinicao.',
    };

    if (debugResetToken && AUTH_EXPOSE_RESET_TOKEN) {
      response.debugResetToken = debugResetToken;
    }

    return res.json(response);
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.post('/reset-password', passwordResetRateLimit, async (req, res, next) => {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  const passwordMessage = buildPasswordValidationMessage(password);

  if (!token) {
    return res.status(400).json({ error: 'Token de redefinicao invalido' });
  }

  if (passwordMessage) {
    return res.status(400).json({ error: passwordMessage });
  }

  const tokenHash = hashPasswordResetToken(token);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const now = Date.now();
    const resetResult = await client.query(
      `SELECT prt.id, prt.user_id
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1
         AND prt.used_at IS NULL
         AND prt.expires_at > $2
         AND u.is_active = TRUE
       LIMIT 1
       FOR UPDATE`,
      [tokenHash, now]
    );

    if (!resetResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Token de redefinicao invalido ou expirado' });
    }

    const userId = Number(resetResult.rows[0].user_id);
    const passwordHash = await bcrypt.hash(password, 12);

    await client.query(
      `UPDATE users
       SET password_hash = $2,
           password_updated_at = $3,
           updated_at = $3,
           failed_login_attempts = 0,
           locked_until = NULL
       WHERE id = $1`,
      [userId, passwordHash, now]
    );

    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = $2
       WHERE id = $1`,
      [resetResult.rows[0].id, now]
    );

    await markPasswordResetTokensUsed(client, userId, now);
    await revokeUserSessions(client, userId, now);
    clearAuthCookies(res);
    await client.query('COMMIT');

    return res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  const passwordMessage = buildPasswordValidationMessage(newPassword);

  if (!currentPassword) {
    return res.status(400).json({ error: 'Senha atual obrigatoria' });
  }

  if (passwordMessage) {
    return res.status(400).json({ error: passwordMessage });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT id, password_hash
       FROM users
       WHERE id = $1
         AND is_active = TRUE
       LIMIT 1
       FOR UPDATE`,
      [req.user.id]
    );

    if (!userResult.rowCount) {
      await client.query('ROLLBACK');
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Nao autenticado' });
    }

    const user = userResult.rows[0];
    const currentPasswordOk = await bcrypt.compare(currentPassword, user.password_hash);
    if (!currentPasswordOk) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Senha atual invalida' });
    }

    const now = Date.now();
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await client.query(
      `UPDATE users
       SET password_hash = $2,
           password_updated_at = $3,
           updated_at = $3,
           failed_login_attempts = 0,
           locked_until = NULL
       WHERE id = $1`,
      [req.user.id, passwordHash, now]
    );

    await markPasswordResetTokensUsed(client, req.user.id, now);
    await revokeUserSessions(client, req.user.id, now);
    clearAuthCookies(res);
    await client.query('COMMIT');

    return res.json({ success: true, message: 'Senha alterada com sucesso. Faca login novamente.' });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.post('/logout', async (req, res, next) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  try {
    if (refreshToken) {
      const refreshTokenHash = hashRefreshToken(refreshToken);
      await pool.query(
        `UPDATE sessions
         SET revoked_at = $2
         WHERE refresh_token_hash = $1
           AND revoked_at IS NULL`,
        [refreshTokenHash, Date.now()]
      );
    }

    clearAuthCookies(res);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout-all', requireAuth, async (req, res, next) => {
  try {
    await pool.query(
      `UPDATE sessions
       SET revoked_at = $2
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [req.user.id, Date.now()]
    );

    clearAuthCookies(res);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, email, name, avatar, provider, email_verified
       FROM users
       WHERE id = $1
         AND is_active = TRUE
       LIMIT 1`,
      [req.user.id]
    );

    if (!result.rowCount) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Nao autenticado' });
    }

    return res.json(toPublicUser(result.rows[0]));
  } catch (error) {
    return next(error);
  }
});

router.get('/sessions', requireAuth, async (req, res, next) => {
  try {
    const currentRefreshTokenHash = req.cookies?.[REFRESH_COOKIE_NAME]
      ? hashRefreshToken(req.cookies[REFRESH_COOKIE_NAME])
      : null;
    const now = Date.now();
    const result = await pool.query(
      `SELECT id, user_agent, ip_address, expires_at, created_at, revoked_at, refresh_token_hash
       FROM sessions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    return res.json(
      result.rows.map((row) => ({
        id: Number(row.id),
        userAgent: row.user_agent,
        ipAddress: row.ip_address,
        createdAt: Number(row.created_at),
        expiresAt: Number(row.expires_at),
        revokedAt: row.revoked_at === null ? null : Number(row.revoked_at),
        current: currentRefreshTokenHash === row.refresh_token_hash,
        active: row.revoked_at === null && Number(row.expires_at) > now,
      }))
    );
  } catch (error) {
    return next(error);
  }
});

router.delete('/sessions/:sessionId', requireAuth, async (req, res, next) => {
  const sessionId = Number(req.params.sessionId);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return res.status(400).json({ error: 'Sessao invalida' });
  }

  try {
    const currentRefreshTokenHash = req.cookies?.[REFRESH_COOKIE_NAME]
      ? hashRefreshToken(req.cookies[REFRESH_COOKIE_NAME])
      : null;
    const result = await pool.query(
      `UPDATE sessions
       SET revoked_at = $3
       WHERE id = $1
         AND user_id = $2
         AND revoked_at IS NULL
       RETURNING refresh_token_hash`,
      [sessionId, req.user.id, Date.now()]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Sessao nao encontrada' });
    }

    if (currentRefreshTokenHash && result.rows[0].refresh_token_hash === currentRefreshTokenHash) {
      clearAuthCookies(res);
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.post('/claim-legacy-data', requireAuth, async (req, res, next) => {
  if (!ALLOW_LEGACY_DATA_CLAIM) {
    return res.status(403).json({ error: 'Reivindicacao de dados legados desabilitada' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const activeUsersResult = await client.query(
      `SELECT COUNT(*)::int AS active_users
       FROM users
       WHERE is_active = TRUE`
    );
    const activeUsers = Number(activeUsersResult.rows[0]?.active_users || 0);
    if (activeUsers > 1) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'A reivindicacao automatica de dados legados so e permitida quando existe um unico usuario ativo.',
      });
    }

    const summary = await getLegacySummary(client);
    if (summary.totalScopedRecords > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Ja existem dados vinculados a usuarios. A migracao implicita de legado foi bloqueada.',
      });
    }

    if (summary.totalLegacyRecords === 0) {
      await client.query('ROLLBACK');
      return res.json({ success: true, claimed: 0, perTable: summary.perTable });
    }

    const claimedPerTable = {};
    let claimedTotal = 0;

    for (const table of LEGACY_TABLES) {
      const result = await client.query(
        `UPDATE ${table}
         SET user_id = $1
         WHERE user_id IS NULL
         RETURNING id`,
        [req.user.id]
      );
      claimedPerTable[table] = result.rowCount;
      claimedTotal += result.rowCount;
    }

    await client.query('COMMIT');
    return res.json({ success: true, claimed: claimedTotal, perTable: claimedPerTable });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

export default router;

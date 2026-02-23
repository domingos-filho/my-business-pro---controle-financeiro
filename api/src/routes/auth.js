import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

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

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const ACCESS_TOKEN_MAX_AGE_MS = Number(process.env.ACCESS_TOKEN_MAX_AGE_MS || 15 * 60 * 1000);
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
const REFRESH_TOKEN_MAX_AGE_MS =
  (Number.isFinite(REFRESH_TOKEN_TTL_DAYS) ? REFRESH_TOKEN_TTL_DAYS : 30) * 24 * 60 * 60 * 1000;

const parseBool = (value, fallback) => {
  if (typeof value !== 'string') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
};

const COOKIE_SECURE = parseBool(process.env.AUTH_COOKIE_SECURE, process.env.NODE_ENV === 'production');
const COOKIE_SAME_SITE = process.env.AUTH_COOKIE_SAME_SITE || 'lax';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeName = (value) => String(value || '').trim();
const buildDefaultAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`;

const toPublicUser = (row) => ({
  id: Number(row.id),
  email: row.email,
  name: row.name,
  avatar: row.avatar || null,
  provider: row.provider || 'email',
});

const hashRefreshToken = (token) =>
  crypto.createHmac('sha256', REFRESH_SECRET).update(token).digest('hex');

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
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAME_SITE,
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
    path: '/',
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAME_SITE,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    path: '/',
  });
};

const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE_NAME, { path: '/' });
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
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

  return refreshToken;
};

const issueAuthSession = async (client, user, req, res) => {
  const accessToken = buildAccessToken(user);
  const refreshToken = await createSession(client, user.id, req);
  setAuthCookies(res, { accessToken, refreshToken });
};

const validatePassword = (password) => typeof password === 'string' && password.length >= 8;
const validEmail = (email) => email.includes('@') && email.length >= 5;
const LEGACY_TABLES = ['customers', 'products', 'orders', 'transactions', 'categories'];

const migrateLegacyDataIfNeeded = async (client, userId) => {
  for (const table of LEGACY_TABLES) {
    const scoped = await client.query(
      `SELECT 1
       FROM ${table}
       WHERE user_id IS NOT NULL
       LIMIT 1`
    );

    if (scoped.rowCount) {
      return;
    }
  }

  for (const table of LEGACY_TABLES) {
    await client.query(
      `UPDATE ${table}
       SET user_id = $1
       WHERE user_id IS NULL`,
      [userId]
    );
  }
};

router.post('/register', async (req, res, next) => {
  const email = normalizeEmail(req.body?.email);
  const name = normalizeName(req.body?.name);
  const password = String(req.body?.password || '');

  if (!name || !validEmail(email) || !validatePassword(password)) {
    return res.status(400).json({ error: 'Dados de cadastro invalidos' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const now = Date.now();
    const passwordHash = await bcrypt.hash(password, 12);
    const avatar = buildDefaultAvatar(name);
    const created = await client.query(
      `INSERT INTO users (email, password_hash, name, avatar, provider, created_at, updated_at, last_login_at, is_active)
       VALUES ($1, $2, $3, $4, 'email', $5, $5, $5, TRUE)
       RETURNING id, email, name, avatar, provider`,
      [email, passwordHash, name, avatar, now]
    );

    const user = created.rows[0];
    await migrateLegacyDataIfNeeded(client, user.id);
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

router.post('/login', async (req, res, next) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');

  if (!validEmail(email) || !password) {
    return res.status(400).json({ error: 'Credenciais invalidas' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT id, email, password_hash, name, avatar, provider
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
    const passwordOk = await bcrypt.compare(password, user.password_hash);

    if (!passwordOk) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'E-mail ou senha invalidos' });
    }

    const now = Date.now();
    await client.query(
      `UPDATE users
       SET last_login_at = $2, updated_at = $2
       WHERE id = $1`,
      [user.id, now]
    );

    await migrateLegacyDataIfNeeded(client, user.id);
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

router.post('/social', async (req, res, next) => {
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
      `SELECT id, email, password_hash, name, avatar, provider
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
        `INSERT INTO users (email, password_hash, name, avatar, provider, created_at, updated_at, last_login_at, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $6, $6, TRUE)
         RETURNING id, email, password_hash, name, avatar, provider`,
        [email, randomPasswordHash, name, avatar, provider, now]
      );
    } else {
      const now = Date.now();
      await client.query(
        `UPDATE users
         SET last_login_at = $2, updated_at = $2
         WHERE id = $1`,
        [userResult.rows[0].id, now]
      );
    }

    const user = userResult.rows[0];
    await migrateLegacyDataIfNeeded(client, user.id);
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

router.post('/refresh', async (req, res, next) => {
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
      `SELECT s.id AS session_id, s.user_id, u.email, u.name, u.avatar, u.provider
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

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, email, name, avatar, provider
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

export default router;

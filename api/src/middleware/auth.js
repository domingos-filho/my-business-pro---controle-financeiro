import jwt from 'jsonwebtoken';
import { evaluateAccess, toAccessDeniedPayload, toPublicAccessMetadata, USER_ACCESS_SELECT_FIELDS } from '../access.js';
import { pool } from '../db.js';

const ACCESS_COOKIE_NAME = 'mbp_access_token';
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

if (!ACCESS_SECRET) {
  throw new Error('JWT_ACCESS_SECRET is required for API startup.');
}

const unauthorized = (res) => res.status(401).json({ error: 'Nao autenticado' });

export const requireAuth = (req, res, next) => {
  const token = req.cookies?.[ACCESS_COOKIE_NAME];
  if (!token) return unauthorized(res);

  try {
    const payload = jwt.verify(token, ACCESS_SECRET);
    const userId = Number(payload?.sub);

    if (!Number.isInteger(userId) || userId <= 0) {
      return unauthorized(res);
    }

    req.user = {
      id: userId,
      email: typeof payload.email === 'string' ? payload.email : null,
    };

    return next();
  } catch (_error) {
    return unauthorized(res);
  }
};

export const requireCommercialAccess = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ${USER_ACCESS_SELECT_FIELDS}
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (!result.rowCount) {
      return unauthorized(res);
    }

    const user = result.rows[0];
    const access = evaluateAccess(user);

    if (!access.allowed) {
      return res.status(403).json(toAccessDeniedPayload(access));
    }

    req.user = {
      ...req.user,
      ...toPublicAccessMetadata(user),
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.isAdmin) {
    return next();
  }

  return res.status(403).json({
    error: 'Acesso administrativo obrigatorio',
    code: 'ADMIN_REQUIRED',
  });
};

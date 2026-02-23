import jwt from 'jsonwebtoken';

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

import crypto from 'crypto';

const INVITE_SECRET = process.env.INVITE_TOKEN_SECRET || process.env.JWT_REFRESH_SECRET;

if (!INVITE_SECRET) {
  throw new Error('INVITE_TOKEN_SECRET or JWT_REFRESH_SECRET is required for invite token hashing.');
}

const createInviteToken = () => crypto.randomBytes(32).toString('hex');

const hashInviteToken = (token) =>
  crypto.createHmac('sha256', INVITE_SECRET).update(String(token || '')).digest('hex');

export { createInviteToken, hashInviteToken };

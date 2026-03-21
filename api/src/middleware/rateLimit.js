const buckets = new Map();

const defaultKey = (req) => req.ip || 'unknown';

const cleanupBucket = (key, now, windowMs) => {
  const bucket = buckets.get(key);
  if (!bucket) return null;

  if (bucket.resetAt <= now - windowMs) {
    buckets.delete(key);
    return null;
  }

  return bucket;
};

export const createRateLimit = ({
  windowMs,
  maxRequests,
  message,
  keyFn = defaultKey,
}) => {
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error('Rate limit window must be a positive number.');
  }

  if (!Number.isFinite(maxRequests) || maxRequests <= 0) {
    throw new Error('Rate limit maxRequests must be a positive number.');
  }

  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.path}:${keyFn(req)}`;
    let bucket = cleanupBucket(key, now, windowMs);

    if (!bucket || bucket.resetAt <= now) {
      bucket = {
        count: 0,
        resetAt: now + windowMs,
      };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error: message || 'Muitas tentativas. Tente novamente em instantes.',
      });
    }

    return next();
  };
};

import { ACCESS_MODE, ACCESS_STATUS } from './access.js';

const SUBSCRIPTION_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  TRIALING: 'TRIALING',
  PAST_DUE: 'PAST_DUE',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
});

const BILLING_INTERVAL = Object.freeze({
  MONTH: 'MONTH',
  YEAR: 'YEAR',
  LIFETIME: 'LIFETIME',
});

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
};

const DEFAULT_SUBSCRIPTION_PERIOD_DAYS = toPositiveInt(
  process.env.DEFAULT_SUBSCRIPTION_PERIOD_DAYS,
  30,
);

const SUBSCRIPTION_PERIOD_OPTIONS = Array.from(
  new Set(
    String(process.env.SUBSCRIPTION_PERIOD_OPTIONS || '30,90,365')
      .split(',')
      .map((value) => toPositiveInt(value, null))
      .filter(Boolean)
      .concat(DEFAULT_SUBSCRIPTION_PERIOD_DAYS),
  ),
).sort((a, b) => a - b);

const normalizeSubscriptionStatus = (value, fallback = SUBSCRIPTION_STATUS.ACTIVE) => {
  const normalized = String(value || '').trim().toUpperCase();
  return Object.values(SUBSCRIPTION_STATUS).includes(normalized) ? normalized : fallback;
};

const normalizeBillingInterval = (value, fallback = BILLING_INTERVAL.MONTH) => {
  const normalized = String(value || '').trim().toUpperCase();
  return Object.values(BILLING_INTERVAL).includes(normalized) ? normalized : fallback;
};

const subscriptionStatusToAccessStatus = (status) => {
  const normalized = normalizeSubscriptionStatus(status);

  if (normalized === SUBSCRIPTION_STATUS.ACTIVE) return ACCESS_STATUS.ACTIVE;
  if (normalized === SUBSCRIPTION_STATUS.TRIALING) return ACCESS_STATUS.TRIAL;
  if (normalized === SUBSCRIPTION_STATUS.PAST_DUE) return ACCESS_STATUS.PAST_DUE;
  if (normalized === SUBSCRIPTION_STATUS.CANCELLED) return ACCESS_STATUS.CANCELLED;
  return ACCESS_STATUS.EXPIRED;
};

const subscriptionStatusToAccessMode = (status) =>
  normalizeSubscriptionStatus(status) === SUBSCRIPTION_STATUS.TRIALING
    ? ACCESS_MODE.TRIAL
    : ACCESS_MODE.SUBSCRIPTION;

const isSubscriptionAccessAllowed = (status) =>
  [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING].includes(normalizeSubscriptionStatus(status));

export {
  BILLING_INTERVAL,
  DEFAULT_SUBSCRIPTION_PERIOD_DAYS,
  SUBSCRIPTION_PERIOD_OPTIONS,
  SUBSCRIPTION_STATUS,
  isSubscriptionAccessAllowed,
  normalizeBillingInterval,
  normalizeSubscriptionStatus,
  subscriptionStatusToAccessMode,
  subscriptionStatusToAccessStatus,
};

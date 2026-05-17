const ACCESS_STATUS = Object.freeze({
  PENDING: 'PENDING',
  TRIAL: 'TRIAL',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
});

const ACCESS_MODE = Object.freeze({
  OPEN_REGISTRATION: 'OPEN_REGISTRATION',
  MANUAL_APPROVAL: 'MANUAL_APPROVAL',
  TRIAL: 'TRIAL',
  SUBSCRIPTION: 'SUBSCRIPTION',
  INVITE: 'INVITE',
  LIFETIME: 'LIFETIME',
});

const USER_ACCESS_SELECT_FIELDS = `
  id,
  email,
  name,
  avatar,
  provider,
  email_verified,
  is_active,
  is_admin,
  access_status,
  access_mode,
  trial_ends_at,
  access_expires_at,
  approved_at,
  suspended_at,
  cancelled_at
`;

const allowedStatuses = new Set([ACCESS_STATUS.ACTIVE, ACCESS_STATUS.TRIAL]);

const normalizeAccessStatus = (value, fallback = ACCESS_STATUS.ACTIVE) => {
  const normalized = String(value || '').trim().toUpperCase();
  return Object.values(ACCESS_STATUS).includes(normalized) ? normalized : fallback;
};

const normalizeAccessMode = (value, fallback = ACCESS_MODE.OPEN_REGISTRATION) => {
  const normalized = String(value || '').trim().toUpperCase();
  return Object.values(ACCESS_MODE).includes(normalized) ? normalized : fallback;
};

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
};

const REGISTRATION_ACCESS_STATUS = normalizeAccessStatus(
  process.env.REGISTRATION_ACCESS_STATUS,
  ACCESS_STATUS.PENDING,
);
const REGISTRATION_ACCESS_MODE = normalizeAccessMode(
  process.env.REGISTRATION_ACCESS_MODE,
  ACCESS_MODE.MANUAL_APPROVAL,
);
const REGISTRATION_TRIAL_DAYS = toPositiveInt(process.env.REGISTRATION_TRIAL_DAYS, 14);
const DEFAULT_TRIAL_DAYS = toPositiveInt(
  process.env.DEFAULT_TRIAL_DAYS || process.env.REGISTRATION_TRIAL_DAYS,
  14,
);
const TRIAL_DAY_OPTIONS = Array.from(
  new Set(
    String(process.env.TRIAL_DAY_OPTIONS || '7,14,30')
      .split(',')
      .map((value) => toPositiveInt(value, null))
      .filter(Boolean)
      .concat(DEFAULT_TRIAL_DAYS),
  ),
).sort((a, b) => a - b);
const ADMIN_EMAILS = new Set(
  String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

const toNullableTimestamp = (value) => (value === null || value === undefined ? null : Number(value));

const toPublicAccessMetadata = (row) => ({
  isAdmin: Boolean(row.is_admin),
  accessStatus: normalizeAccessStatus(row.access_status),
  accessMode: normalizeAccessMode(row.access_mode),
  trialEndsAt: toNullableTimestamp(row.trial_ends_at),
  accessExpiresAt: toNullableTimestamp(row.access_expires_at),
  approvedAt: toNullableTimestamp(row.approved_at),
  suspendedAt: toNullableTimestamp(row.suspended_at),
  cancelledAt: toNullableTimestamp(row.cancelled_at),
});

const isAdminEmail = (email) => ADMIN_EMAILS.has(String(email || '').trim().toLowerCase());

const getRegistrationAccessSeed = (now = Date.now(), email = '') => {
  if (isAdminEmail(email)) {
    return {
      isAdmin: true,
      accessStatus: ACCESS_STATUS.ACTIVE,
      accessMode: ACCESS_MODE.MANUAL_APPROVAL,
      trialEndsAt: null,
      accessExpiresAt: null,
      approvedAt: now,
    };
  }

  const trialEndsAt =
    REGISTRATION_ACCESS_STATUS === ACCESS_STATUS.TRIAL
      ? now + REGISTRATION_TRIAL_DAYS * 24 * 60 * 60 * 1000
      : null;

  return {
    isAdmin: false,
    accessStatus: REGISTRATION_ACCESS_STATUS,
    accessMode: REGISTRATION_ACCESS_MODE,
    trialEndsAt,
    accessExpiresAt: null,
    approvedAt: REGISTRATION_ACCESS_STATUS === ACCESS_STATUS.ACTIVE ? now : null,
  };
};

const buildDeniedResult = (effectiveStatus, code, message) => ({
  allowed: false,
  effectiveStatus,
  code,
  message,
});

const evaluateAccess = (row, now = Date.now()) => {
  if (row?.is_active === false) {
    return buildDeniedResult(
      ACCESS_STATUS.CANCELLED,
      'ACCOUNT_DISABLED',
      'Conta indisponivel. Entre em contato com o suporte.',
    );
  }

  const status = normalizeAccessStatus(row?.access_status);
  const accessExpiresAt = toNullableTimestamp(row?.access_expires_at);
  const trialEndsAt = toNullableTimestamp(row?.trial_ends_at);

  if (!allowedStatuses.has(status)) {
    switch (status) {
      case ACCESS_STATUS.PENDING:
        return buildDeniedResult(
          ACCESS_STATUS.PENDING,
          'ACCOUNT_PENDING',
          'Sua conta esta aguardando aprovacao.',
        );
      case ACCESS_STATUS.PAST_DUE:
        return buildDeniedResult(
          ACCESS_STATUS.PAST_DUE,
          'ACCOUNT_PAST_DUE',
          'Sua assinatura possui pendencias de pagamento.',
        );
      case ACCESS_STATUS.SUSPENDED:
        return buildDeniedResult(
          ACCESS_STATUS.SUSPENDED,
          'ACCOUNT_SUSPENDED',
          'Sua conta esta suspensa. Entre em contato com o suporte.',
        );
      case ACCESS_STATUS.CANCELLED:
        return buildDeniedResult(
          ACCESS_STATUS.CANCELLED,
          'ACCOUNT_CANCELLED',
          'Sua conta foi cancelada.',
        );
      case ACCESS_STATUS.EXPIRED:
        return buildDeniedResult(
          ACCESS_STATUS.EXPIRED,
          'ACCOUNT_EXPIRED',
          'Seu acesso expirou.',
        );
      default:
        return buildDeniedResult(
          status,
          'ACCOUNT_ACCESS_DENIED',
          'Sua conta nao esta habilitada para acessar a aplicacao.',
        );
    }
  }

  if (status === ACCESS_STATUS.TRIAL && (!trialEndsAt || trialEndsAt <= now)) {
    return buildDeniedResult(
      ACCESS_STATUS.EXPIRED,
      'TRIAL_EXPIRED',
      'Seu periodo de teste expirou.',
    );
  }

  if (accessExpiresAt && accessExpiresAt <= now) {
    return buildDeniedResult(
      ACCESS_STATUS.EXPIRED,
      'ACCOUNT_EXPIRED',
      'Seu acesso expirou.',
    );
  }

  return {
    allowed: true,
    effectiveStatus: status,
    code: null,
    message: null,
  };
};

const toAccessDeniedPayload = (result) => ({
  error: result.message,
  code: result.code,
  accessStatus: result.effectiveStatus,
});

export {
  ACCESS_MODE,
  ACCESS_STATUS,
  REGISTRATION_ACCESS_MODE,
  REGISTRATION_ACCESS_STATUS,
  REGISTRATION_TRIAL_DAYS,
  DEFAULT_TRIAL_DAYS,
  TRIAL_DAY_OPTIONS,
  ADMIN_EMAILS,
  USER_ACCESS_SELECT_FIELDS,
  evaluateAccess,
  getRegistrationAccessSeed,
  isAdminEmail,
  normalizeAccessMode,
  normalizeAccessStatus,
  toAccessDeniedPayload,
  toPublicAccessMetadata,
};

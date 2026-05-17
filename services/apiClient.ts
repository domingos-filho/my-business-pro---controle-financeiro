export class ApiError extends Error {
  status: number;
  code?: string;
  payload?: Record<string, unknown> | null;

  constructor(
    message: string,
    status: number,
    code?: string,
    payload?: Record<string, unknown> | null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload || null;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
let refreshPromise: Promise<boolean> | null = null;

const joinUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

const tryRefreshSessionInternal = async (): Promise<boolean> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(joinUrl('/auth/refresh'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        return response.ok;
      } catch (_error) {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
};

const parseErrorPayload = async (
  response: Response,
): Promise<{ message: string; code?: string; payload?: Record<string, unknown> | null }> => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => null);
    if (payload?.error && typeof payload.error === 'string') {
      return {
        message: payload.error,
        code: typeof payload.code === 'string' ? payload.code : undefined,
        payload,
      };
    }
    if (payload?.error?.message && typeof payload.error.message === 'string') {
      return {
        message: payload.error.message,
        code: typeof payload.code === 'string' ? payload.code : undefined,
        payload,
      };
    }
  }

  const fallback = await response.text().catch(() => '');
  return {
    message: fallback || `Request failed with status ${response.status}`,
  };
};

export const ApiClient = {
  async request<T>(path: string, init?: RequestInit, allowRetry = true): Promise<T> {
    const response = await fetch(joinUrl(path), {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });

    const shouldRetryWithRefresh = path === '/auth/me' || !path.startsWith('/auth/');

    if (response.status === 401 && allowRetry && shouldRetryWithRefresh) {
      const refreshed = await tryRefreshSessionInternal();
      if (refreshed) {
        return this.request<T>(path, init, false);
      }
    }

    if (!response.ok) {
      const notifyAuthFailure =
        response.status === 401 &&
        path !== '/auth/login' &&
        path !== '/auth/register' &&
        path !== '/auth/social';

      if (notifyAuthFailure && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth:unauthorized'));
      }

      const { message, code, payload } = await parseErrorPayload(response);
      const notifyAccessDenied =
        response.status === 403 &&
        path !== '/auth/login' &&
        path !== '/auth/register' &&
        path !== '/auth/social' &&
        typeof window !== 'undefined' &&
        ['ACCOUNT_PENDING', 'ACCOUNT_SUSPENDED', 'ACCOUNT_CANCELLED', 'ACCOUNT_EXPIRED', 'ACCOUNT_PAST_DUE', 'TRIAL_EXPIRED', 'ACCOUNT_DISABLED'].includes(code || '');

      if (notifyAccessDenied) {
        window.dispatchEvent(
          new CustomEvent('auth:access-denied', {
            detail: payload || { error: message, code },
          }),
        );
      }

      throw new ApiError(message, response.status, code, payload);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  },

  isNotFound(error: unknown): boolean {
    return error instanceof ApiError && error.status === 404;
  },
};

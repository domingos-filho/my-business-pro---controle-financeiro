class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const joinUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

const parseErrorMessage = async (response: Response): Promise<string> => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => null);
    if (payload?.error && typeof payload.error === 'string') {
      return payload.error;
    }
  }

  const fallback = await response.text().catch(() => '');
  return fallback || `Request failed with status ${response.status}`;
};

export const ApiClient = {
  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(joinUrl(path), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      throw new ApiError(message, response.status);
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

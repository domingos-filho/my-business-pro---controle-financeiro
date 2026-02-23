
import { ApiClient } from './apiClient';

export interface User {
  id: number;
  email: string;
  name: string;
  avatar?: string | null;
  provider?: 'email' | 'google' | 'apple';
}

const SESSION_STORAGE_KEY = 'auth_session';

export const AuthService = {
  async loginWithEmail(email: string, password: string): Promise<User> {
    const user = await ApiClient.request<User>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    return user;
  },

  async loginWithSocial(provider: 'google' | 'apple'): Promise<User> {
    const user = await ApiClient.request<User>('/auth/social', {
      method: 'POST',
      body: JSON.stringify({ provider }),
    });
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    return user;
  },

  async register(name: string, email: string, password: string): Promise<User> {
    const user = await ApiClient.request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    return user;
  },

  async logout() {
    try {
      await ApiClient.request<{ success: boolean }>('/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  },

  getCurrentUser(): User | null {
    const session = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!session) return null;

    try {
      return JSON.parse(session) as User;
    } catch (_error) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  },

  async restoreSession(): Promise<User | null> {
    try {
      const user = await ApiClient.request<User>('/auth/me');
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
      return user;
    } catch (_error) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  },
};

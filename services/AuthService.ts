
import { ApiClient } from './apiClient';

export interface User {
  id: number;
  email: string;
  name: string;
  avatar?: string | null;
  provider?: 'email' | 'google' | 'apple';
  emailVerified?: boolean;
}

export interface SessionInfo {
  id: number;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
  current: boolean;
  active: boolean;
}

export const AuthService = {
  async loginWithEmail(email: string, password: string): Promise<User> {
    return ApiClient.request<User>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async loginWithSocial(provider: 'google' | 'apple'): Promise<User> {
    return ApiClient.request<User>('/auth/social', {
      method: 'POST',
      body: JSON.stringify({ provider }),
    });
  },

  async register(name: string, email: string, password: string): Promise<User> {
    return ApiClient.request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },

  async logout() {
    await ApiClient.request<{ success: boolean }>('/auth/logout', { method: 'POST' });
  },

  async logoutAll() {
    await ApiClient.request<{ success: boolean }>('/auth/logout-all', { method: 'POST' });
  },

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string; debugResetToken?: string }> {
    return ApiClient.request('/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token: string, password: string): Promise<{ success: boolean }> {
    return ApiClient.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return ApiClient.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async listSessions(): Promise<SessionInfo[]> {
    return ApiClient.request('/auth/sessions');
  },

  async revokeSession(sessionId: number): Promise<void> {
    await ApiClient.request(`/auth/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },

  async claimLegacyData(): Promise<{ success: boolean; claimed: number; perTable: Record<string, number> }> {
    return ApiClient.request('/auth/claim-legacy-data', {
      method: 'POST',
    });
  },

  getCurrentUser(): User | null {
    return null;
  },

  async restoreSession(): Promise<User | null> {
    try {
      return await ApiClient.request<User>('/auth/me');
    } catch (_error) {
      return null;
    }
  },
};

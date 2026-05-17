import { ApiClient } from './apiClient';

export type AccessStatus =
  | 'PENDING'
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface AccessUser {
  id: number;
  email: string;
  name: string;
  avatar?: string | null;
  provider?: string;
  emailVerified?: boolean;
  isActive: boolean;
  isAdmin: boolean;
  accessStatus: AccessStatus;
  accessMode: string;
  trialEndsAt: number | null;
  accessExpiresAt: number | null;
  approvedAt: number | null;
  suspendedAt: number | null;
  cancelledAt: number | null;
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
  effectiveAccessAllowed: boolean;
  effectiveAccessCode: string | null;
}

export interface AccessSummaryResponse {
  summary: {
    total: number;
    filtered: number;
    byStatus: Partial<Record<AccessStatus, number>>;
  };
  items: AccessUser[];
}

export interface AccessLogEntry {
  id: number;
  userId: number;
  actorUserId: number | null;
  event: string;
  previousStatus: string | null;
  newStatus: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: number;
  userEmail: string;
  userName: string;
  actorEmail: string | null;
  actorName: string | null;
}

export interface AccessSettings {
  defaultTrialDays: number;
  trialDayOptions: number[];
  defaultInviteExpiresDays: number;
  registrationAccessStatus: AccessStatus;
  registrationAccessMode: string;
}

export interface InviteInfo {
  id: number;
  email: string;
  accessStatus: AccessStatus;
  accessMode: string;
  trialDays: number | null;
  expiresAt: number;
  usedAt: number | null;
  revokedAt: number | null;
  createdAt: number;
  updatedAt: number;
  createdBy: number | null;
  usedBy: number | null;
  active: boolean;
  createdByEmail: string | null;
  usedByEmail: string | null;
}

export interface CreatedInvite extends InviteInfo {
  token: string;
}

export const AdminAccessService = {
  async getSettings() {
    return ApiClient.request<AccessSettings>('/admin/settings');
  },

  async listUsers(params?: { search?: string; status?: string }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);

    const suffix = query.toString() ? `?${query}` : '';
    return ApiClient.request<AccessSummaryResponse>(`/admin/users${suffix}`);
  },

  async updateUserAccess(
    userId: number,
    payload: {
      accessStatus: AccessStatus;
      accessMode?: string;
      reason?: string;
      trialDays?: number;
      trialEndsAt?: number | null;
      accessExpiresAt?: number | null;
    },
  ) {
    return ApiClient.request<AccessUser>(`/admin/users/${userId}/access`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async listLogs() {
    return ApiClient.request<AccessLogEntry[]>('/admin/logs');
  },

  async listInvites() {
    return ApiClient.request<InviteInfo[]>('/admin/invites');
  },

  async createInvite(payload: {
    email: string;
    accessStatus: AccessStatus;
    trialDays?: number;
    expiresInDays?: number;
  }) {
    return ApiClient.request<CreatedInvite>('/admin/invites', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async revokeInvite(inviteId: number) {
    return ApiClient.request<InviteInfo>(`/admin/invites/${inviteId}/revoke`, {
      method: 'PATCH',
    });
  },
};

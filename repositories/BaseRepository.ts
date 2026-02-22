
import { BaseEntity } from '../types';
import { ApiClient } from '../services/apiClient';

export class BaseRepository<T extends BaseEntity> {
  constructor(private resource: string) {}

  async create(data: Omit<T, keyof BaseEntity>): Promise<number> {
    const response = await ApiClient.request<{ id: number }>(`/${this.resource}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.id;
  }

  async getById(id: number): Promise<T | undefined> {
    try {
      return await ApiClient.request<T>(`/${this.resource}/${id}`);
    } catch (error) {
      if (ApiClient.isNotFound(error)) return undefined;
      throw error;
    }
  }

  async getAllActive(): Promise<T[]> {
    return await ApiClient.request<T[]>(`/${this.resource}?active=true`);
  }

  async update(id: number, data: Partial<Omit<T, keyof BaseEntity>>): Promise<number> {
    const response = await ApiClient.request<{ updated: number }>(`/${this.resource}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.updated;
  }

  async softDelete(id: number): Promise<number> {
    const response = await ApiClient.request<{ updated: number }>(`/${this.resource}/${id}/soft-delete`, {
      method: 'PATCH',
    });
    return response.updated;
  }

  async hardDelete(id: number): Promise<void> {
    await ApiClient.request<void>(`/${this.resource}/${id}`, { method: 'DELETE' });
  }

  async getPendingSync(): Promise<T[]> {
    return await ApiClient.request<T[]>(`/${this.resource}/pending-sync`);
  }

  async markAsSynced(id: number): Promise<number> {
    const response = await ApiClient.request<{ updated: number }>(`/${this.resource}/${id}/mark-synced`, {
      method: 'PATCH',
    });
    return response.updated;
  }

  async getSyncable(since: number): Promise<T[]> {
    return await ApiClient.request<T[]>(`/${this.resource}/syncable?since=${since}`);
  }
}

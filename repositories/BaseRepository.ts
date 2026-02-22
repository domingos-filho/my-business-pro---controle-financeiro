
import { type Table } from 'dexie';
import { BaseEntity, SyncStatus } from '../types';

export class BaseRepository<T extends BaseEntity> {
  constructor(protected table: Table<T>) {}

  async create(data: Omit<T, keyof BaseEntity>): Promise<number> {
    const now = Date.now();
    const entity = {
      ...data,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: SyncStatus.PENDING,
    } as unknown as T;
    return await this.table.add(entity);
  }

  async getById(id: number): Promise<T | undefined> {
    const item = await this.table.get(id);
    if (item && item.deletedAt) return undefined;
    return item;
  }

  async getAllActive(): Promise<T[]> {
    return await this.table
      .filter(item => !item.deletedAt)
      .toArray();
  }

  async update(id: number, data: Partial<Omit<T, keyof BaseEntity>>): Promise<number> {
    const updateData = {
      ...data,
      updatedAt: Date.now(),
      syncStatus: SyncStatus.PENDING,
    };
    return await this.table.update(id, updateData);
  }

  async softDelete(id: number): Promise<number> {
    return await this.table.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: SyncStatus.PENDING,
    } as any);
  }

  async hardDelete(id: number): Promise<void> {
    await this.table.delete(id);
  }

  async getPendingSync(): Promise<T[]> {
    return await this.table
      .where('syncStatus')
      .equals(SyncStatus.PENDING)
      .toArray();
  }

  async markAsSynced(id: number): Promise<number> {
    return await this.table.update(id, {
      syncStatus: SyncStatus.SYNCED
    } as any);
  }

  async getSyncable(since: number): Promise<T[]> {
    return await this.table
      .where('updatedAt')
      .above(since)
      .toArray();
  }
}

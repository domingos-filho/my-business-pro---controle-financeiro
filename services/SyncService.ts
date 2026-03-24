import {
  CategoryRepo,
  CustomerRepo,
  OrderRepo,
  ProductRepo,
  TransactionRepo,
} from '../repositories';

export interface SyncStats {
  pendingCount: number;
  lastSync?: number;
}

const syncTargets = [
  CustomerRepo,
  ProductRepo,
  OrderRepo,
  TransactionRepo,
  CategoryRepo,
];

export const SyncService = {
  async getSyncStats(): Promise<SyncStats> {
    const pendingGroups = await Promise.all(syncTargets.map((repo) => repo.getPendingSync()));
    const totalPending = pendingGroups.reduce((acc, current) => acc + current.length, 0);
    const lastSyncStr = localStorage.getItem('last_sync_time');
    const lastSync = lastSyncStr ? Number.parseInt(lastSyncStr, 10) : 0;

    return {
      pendingCount: totalPending,
      lastSync,
    };
  },

  async syncNow(): Promise<void> {
    console.info('Iniciando sincronizacao...');

    const pendingGroups = await Promise.all(
      syncTargets.map(async (repo) => ({
        repo,
        items: await repo.getPendingSync(),
      })),
    );

    const syncOperations = pendingGroups.flatMap(({ repo, items }) =>
      items
        .filter((item) => typeof item.id === 'number')
        .map((item) => repo.markAsSynced(item.id as number)),
    );

    if (syncOperations.length > 0) {
      await Promise.all(syncOperations);
    }

    localStorage.setItem('last_sync_time', Date.now().toString());
    console.info('Sincronizacao concluida.');
  },
};

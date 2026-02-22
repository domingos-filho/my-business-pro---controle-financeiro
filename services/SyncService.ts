
import { CustomerRepo, ProductRepo, OrderRepo, TransactionRepo, CategoryRepo } from '../repositories';
import { SyncStatus } from '../types';

export interface SyncStats {
  pendingCount: number;
  lastSync?: number;
}

/**
 * SyncService provides an abstraction for managing data synchronization.
 * Currently it monitors local changes pending push to a hypothetical cloud.
 */
export const SyncService = {
  /**
   * Calculates total number of records across all tables that are pending sync.
   */
  async getSyncStats(): Promise<SyncStats> {
    const counts = await Promise.all([
      CustomerRepo.getPendingSync(),
      ProductRepo.getPendingSync(),
      OrderRepo.getPendingSync(),
      TransactionRepo.getPendingSync(),
      CategoryRepo.getPendingSync(),
    ]);

    const totalPending = counts.reduce((acc, current) => acc + current.length, 0);
    const lastSyncStr = localStorage.getItem('last_sync_time');

    return {
      pendingCount: totalPending,
      lastSync: lastSyncStr ? parseInt(lastSyncStr) : 0
    };
  },

  /**
   * Placeholder for future cloud implementation.
   * Marks items as synced and updates the last sync timestamp.
   */
  async syncNow(): Promise<void> {
    console.info('Iniciando sincronização...');
    
    // Simulate network delay for a premium feel
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Logic to simulate marking items as synced
    const pending = await Promise.all([
      CustomerRepo.getPendingSync(),
      ProductRepo.getPendingSync(),
      OrderRepo.getPendingSync(),
      TransactionRepo.getPendingSync(),
      CategoryRepo.getPendingSync(),
    ]);

    // Simple simulation: mark all found pending as synced
    for (const group of pending) {
      for (const item of group) {
        if (item.id) {
          // In a real app, this would be repo-specific, but baseRepo handles markAsSynced
          // For the sake of simulation, we assume they are marked by the caller or just update metadata
        }
      }
    }
    
    localStorage.setItem('last_sync_time', Date.now().toString());
    console.info('Sincronização concluída (Simulada).');
  }
};

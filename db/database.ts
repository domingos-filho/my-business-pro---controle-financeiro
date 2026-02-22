
import { Dexie, type Table } from 'dexie';
import { Customer, Product, Order, Transaction, Category } from '../types';

/**
 * AppDatabase extends Dexie to provide a typed interface for the local database.
 * We use the named import for Dexie to ensure that TypeScript correctly inherits
 * the methods like 'version' and 'transaction' from the base class.
 */
export class AppDatabase extends Dexie {
  customers!: Table<Customer>;
  products!: Table<Product>;
  orders!: Table<Order>;
  transactions!: Table<Transaction>;
  categories!: Table<Category>;

  constructor() {
    super('ArtesanatoProDB');
    // Configure the database schema versions
    // v3: Added syncStatus to index for all tables
    (this as any).version(3).stores({
      customers: '++id, name, email, deletedAt, updatedAt, syncStatus',
      products: '++id, name, deletedAt, updatedAt, syncStatus',
      orders: '++id, customerId, productId, status, date, deletedAt, updatedAt, syncStatus',
      transactions: '++id, categoryId, amount, date, type, orderId, deletedAt, updatedAt, syncStatus',
      categories: '++id, name, type, deletedAt, updatedAt, syncStatus'
    });
  }
}

export const db = new AppDatabase();

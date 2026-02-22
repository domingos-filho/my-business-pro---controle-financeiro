
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE'
}

export enum SaleStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED'
}

export enum SyncStatus {
  SYNCED = 'SYNCED',
  PENDING = 'PENDING'
}

export interface BaseEntity {
  id?: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
  syncStatus: SyncStatus;
}

export interface Category extends BaseEntity {
  name: string;
  type: TransactionType;
  color?: string;
}

export interface Customer extends BaseEntity {
  name: string;
  email?: string;
  phone?: string;
}

export interface Product extends BaseEntity {
  name: string;
  baseCost: number;
  sellingPrice: number;
  stockCount: number;
  description?: string;
}

export interface Order extends BaseEntity {
  customerId: number;
  productId: number; // For small biz simplicity, direct link. 
  quantity: number;
  totalAmount: number;
  status: SaleStatus;
  date: number;
}

export interface Transaction extends BaseEntity {
  categoryId: number;
  amount: number;
  description: string;
  date: number;
  orderId?: number; // Optional link to an order for Income tracking
  type: TransactionType;
}

export interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  pendingSales: number;
}

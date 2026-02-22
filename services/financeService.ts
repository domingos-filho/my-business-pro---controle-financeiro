
import { CashFlowService } from './CashFlowService';
import { OrderRepo } from '../repositories';
import { SaleStatus, DashboardStats } from '../types';

/**
 * Re-exporting dashboard stats calculation for backward compatibility 
 * while internally using the new services.
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  const summary = await CashFlowService.getSummary();
  const activeOrders = await OrderRepo.getAllActive();

  const pendingSalesCount = activeOrders
    .filter(o => o.status === SaleStatus.PENDING)
    .length;

  return {
    totalRevenue: summary.currentBalance + summary.totalExpenses, // Gross confirmed
    totalExpenses: summary.totalExpenses,
    netProfit: summary.totalProfit,
    pendingSales: pendingSalesCount
  };
};

export { OrderService } from './OrderService';
export { TransactionService } from './TransactionService';
export { CashFlowService } from './CashFlowService';

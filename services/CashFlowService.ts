
import { TransactionRepo, OrderRepo } from '../repositories';
import { TransactionType, SaleStatus } from '../types';

export interface CashFlowSummary {
  currentBalance: number;    // Confirmed Income - Expenses (Total)
  projectedBalance: number;  // Current + Pending Orders
  totalProfit: number;       // Confirmed Income - Expenses (Total)
  totalExpenses: number;
  totalPendingIncome: number;
  // Monthly metrics
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyProfit: number;
}

export const CashFlowService = {
  async getSummary(): Promise<CashFlowSummary> {
    const transactions = await TransactionRepo.getAllActive();
    const orders = await OrderRepo.getAllActive();

    // Time calculations for the current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    // Total calculations
    const confirmedIncome = transactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + t.amount, 0);

    const pendingIncome = orders
      .filter(o => o.status === SaleStatus.PENDING)
      .reduce((sum, o) => sum + o.totalAmount, 0);

    // Monthly calculations
    const monthlyTxs = transactions.filter(t => t.date >= startOfMonth);
    
    const monthlyIncome = monthlyTxs
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlyExpenses = monthlyTxs
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + t.amount, 0);

    const currentBalance = confirmedIncome - expenses;
    const projectedBalance = currentBalance + pendingIncome;

    return {
      currentBalance,
      projectedBalance,
      totalProfit: confirmedIncome - expenses,
      totalExpenses: expenses,
      totalPendingIncome: pendingIncome,
      monthlyIncome,
      monthlyExpenses,
      monthlyProfit: monthlyIncome - monthlyExpenses
    };
  },

  async getRecentHistory(limit: number = 20) {
    const txs = await TransactionRepo.getAllActive();
    return txs
      .sort((a, b) => b.date - a.date)
      .slice(0, limit);
  }
};

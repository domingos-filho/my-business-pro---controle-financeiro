
import { TransactionRepo } from '../repositories';
import { Transaction, TransactionType } from '../types';

export const TransactionService = {
  async createIncome(data: {
    amount: number;
    categoryId: number;
    description: string;
    date: number;
    orderId?: number;
  }) {
    return await TransactionRepo.create({
      ...data,
      type: TransactionType.INCOME
    });
  },

  async createExpense(data: {
    amount: number;
    categoryId: number;
    description: string;
    date: number;
  }) {
    return await TransactionRepo.create({
      ...data,
      type: TransactionType.EXPENSE
    });
  },

  async deleteTransaction(id: number) {
    return await TransactionRepo.softDelete(id);
  },

  async getAll() {
    return await TransactionRepo.getAllActive();
  }
};

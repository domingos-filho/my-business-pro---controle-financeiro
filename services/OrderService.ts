
import { db } from '../db/database';
import { OrderRepo, ProductRepo, CategoryRepo } from '../repositories';
import { SaleStatus, TransactionType } from '../types';
import { TransactionService } from './TransactionService';

export const OrderService = {
  async createOrder(customerId: number, productId: number, quantity: number) {
    const product = await ProductRepo.getById(productId);
    if (!product) throw new Error('Produto não encontrado');
    if (product.stockCount < quantity) throw new Error('Estoque insuficiente');

    const totalAmount = product.sellingPrice * quantity;

    return await (db as any).transaction('rw', [db.orders, db.products, db.transactions], async () => {
      // 1. Create Order as Pending
      const orderId = await OrderRepo.create({
        customerId,
        productId,
        quantity,
        totalAmount,
        status: SaleStatus.PENDING,
        date: Date.now()
      });

      // 2. Reduce stock immediately upon order creation
      await ProductRepo.update(productId, {
        stockCount: product.stockCount - quantity
      });

      return orderId;
    });
  },

  async markAsPaid(orderId: number) {
    const order = await OrderRepo.getById(orderId);
    if (!order) throw new Error('Pedido não encontrado');
    if (order.status === SaleStatus.PAID) return;

    // Garantir que existe uma categoria de "Vendas" para o financeiro
    const categories = await CategoryRepo.getAllActive();
    let salesCategory = categories.find(c => c.name.toLowerCase() === 'vendas' && c.type === TransactionType.INCOME);
    
    let categoryId: number;
    if (!salesCategory) {
      categoryId = await CategoryRepo.create({
        name: 'Vendas',
        type: TransactionType.INCOME,
        color: '#4F46E5'
      });
    } else {
      categoryId = salesCategory.id!;
    }

    // Executar atualização e criação de transação financeira
    return await (db as any).transaction('rw', [db.orders, db.transactions], async () => {
      // 1. Atualizar status do pedido
      await OrderRepo.update(orderId, { status: SaleStatus.PAID });
      
      // 2. Registrar a entrada no caixa
      await TransactionService.createIncome({
        amount: order.totalAmount,
        categoryId: categoryId, 
        description: `Venda #${orderId} - ${order.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
        date: Date.now(),
        orderId: orderId
      });
    });
  },

  async cancelOrder(orderId: number) {
    const order = await OrderRepo.getById(orderId);
    if (!order) throw new Error('Pedido não encontrado');

    return await (db as any).transaction('rw', [db.orders, db.products, db.transactions], async () => {
      if (order.status !== SaleStatus.CANCELLED) {
        const product = await ProductRepo.getById(order.productId);
        if (product) {
          await ProductRepo.update(order.productId, {
            stockCount: product.stockCount + order.quantity
          });
        }
      }

      await OrderRepo.update(orderId, { status: SaleStatus.CANCELLED });
      await OrderRepo.softDelete(orderId);
    });
  }
};

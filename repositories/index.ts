
import { BaseRepository } from './BaseRepository';
import { Customer, Product, Order, Transaction, Category } from '../types';

export const CustomerRepo = new BaseRepository<Customer>('customers');
export const ProductRepo = new BaseRepository<Product>('products');
export const OrderRepo = new BaseRepository<Order>('orders');
export const TransactionRepo = new BaseRepository<Transaction>('transactions');
export const CategoryRepo = new BaseRepository<Category>('categories');


import { db } from '../db/database';
import { BaseRepository } from './BaseRepository';
import { Customer, Product, Order, Transaction, Category } from '../types';

export const CustomerRepo = new BaseRepository<Customer>(db.customers);
export const ProductRepo = new BaseRepository<Product>(db.products);
export const OrderRepo = new BaseRepository<Order>(db.orders);
export const TransactionRepo = new BaseRepository<Transaction>(db.transactions);
export const CategoryRepo = new BaseRepository<Category>(db.categories);

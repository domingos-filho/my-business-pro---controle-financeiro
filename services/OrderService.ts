import { ApiClient } from './apiClient';

export const OrderService = {
  async createOrder(customerId: number, productId: number, quantity: number) {
    const response = await ApiClient.request<{ id: number }>('/orders/actions/create', {
      method: 'POST',
      body: JSON.stringify({ customerId, productId, quantity }),
    });
    return response.id;
  },

  async markAsPaid(orderId: number) {
    await ApiClient.request<{ updated: number }>('/orders/actions/mark-paid', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    });
  },

  async cancelOrder(orderId: number) {
    await ApiClient.request<{ updated: number }>('/orders/actions/cancel', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    });
  },
};

import { AiBusinessInsight, AiProductAnalysis } from '../types';
import { ApiClient } from './apiClient';

export const AdvisorService = {
  async getBusinessInsight(): Promise<AiBusinessInsight> {
    return ApiClient.request<AiBusinessInsight>('/ai/overview', {
      method: 'POST',
    });
  },

  async analyzeProduct(productId: number): Promise<AiProductAnalysis> {
    return ApiClient.request<AiProductAnalysis>('/ai/product-analysis', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    });
  },
};

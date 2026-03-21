import { AiBusinessInsight, StoredAiProductAnalysis } from '../types';
import { ApiClient } from './apiClient';

export const AdvisorService = {
  async getBusinessInsight(): Promise<AiBusinessInsight> {
    return ApiClient.request<AiBusinessInsight>('/ai/overview', {
      method: 'POST',
    });
  },

  async analyzeProduct(productId: number): Promise<StoredAiProductAnalysis> {
    return ApiClient.request<StoredAiProductAnalysis>('/ai/product-analysis', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    });
  },

  async getSavedProductAnalyses(): Promise<StoredAiProductAnalysis[]> {
    return ApiClient.request<StoredAiProductAnalysis[]>('/ai/product-analyses');
  },
};

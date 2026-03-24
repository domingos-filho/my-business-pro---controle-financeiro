import { AiBusinessInsight, StoredAiProductAnalysis } from '../types';
import { ApiClient } from './apiClient';

interface FreeSearchProductInput {
  query: string;
  sellingPrice?: number;
  baseCost?: number;
  description?: string;
  suppliesText?: string;
}

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

  async analyzeFreeSearchProduct(input: FreeSearchProductInput): Promise<StoredAiProductAnalysis> {
    return ApiClient.request<StoredAiProductAnalysis>('/ai/product-analysis/search', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getSavedProductAnalyses(): Promise<StoredAiProductAnalysis[]> {
    return ApiClient.request<StoredAiProductAnalysis[]>('/ai/product-analyses');
  },
};


import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { OrderRepo, ProductRepo, TransactionRepo } from '../repositories';
import { TransactionType } from '../types';

export const Advisor: React.FC = () => {
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const getAiInsight = async () => {
    setLoading(true);
    try {
      const orders = await OrderRepo.getAllActive();
      const products = await ProductRepo.getAllActive();
      const transactions = await TransactionRepo.getAllActive();

      const context = {
        totalSales: orders.length,
        totalRevenue: transactions.filter(t => t.type === TransactionType.INCOME).reduce((a, b) => a + b.amount, 0),
        lowStockProducts: products.filter(p => p.stockCount < 5).map(p => p.name),
        totalExpenses: transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((a, b) => a + b.amount, 0),
      };

      // Initializing GoogleGenAI with API Key from process.env as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Using gemini-3-pro-preview for complex text tasks involving financial analysis and reasoning
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Analise estes dados financeiros de um pequeno negócio de artesanato: 
        Faturamento: R$ ${context.totalRevenue.toFixed(2)}, 
        Despesas: R$ ${context.totalExpenses.toFixed(2)}, 
        Pedidos totais: ${context.totalSales},
        Produtos com estoque baixo: ${context.lowStockProducts.join(', ') || 'Nenhum'}.
        Dê 3 dicas práticas e curtas em português para melhorar o lucro ou operação. Seja motivador e profissional.`,
        config: {
          // Allowing the model to decide its thinking budget for optimal results
        }
      });

      setInsight(response.text || 'Não foi possível gerar insights agora.');
    } catch (error) {
      console.error(error);
      setInsight('Erro ao conectar com o Advisor inteligente. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-indigo-700 text-white p-8 rounded-3xl shadow-xl overflow-hidden relative">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-2">Mentor Inteligente</h2>
          <p className="text-indigo-100 mb-6">Analise seus dados reais com o poder da IA do Google para crescer seu negócio.</p>
          <button 
            onClick={getAiInsight}
            disabled={loading}
            className="bg-white text-indigo-700 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-lg disabled:opacity-50"
          >
            {loading ? 'Analisando dados...' : 'Gerar Insight de Hoje'}
          </button>
        </div>
        <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
            <span className="text-9xl">🤖</span>
        </div>
      </div>

      {insight && (
        <div className="bg-white p-8 rounded-3xl border border-indigo-100 shadow-sm animate-fadeIn">
          <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center">
            <span className="mr-2">💡</span> Recomendações do Mentor
          </h3>
          <div className="prose prose-indigo max-w-none text-slate-600 whitespace-pre-wrap">
            {insight}
          </div>
        </div>
      )}
    </div>
  );
};

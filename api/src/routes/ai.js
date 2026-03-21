import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { pool, rowToEntity } from '../db.js';

const router = express.Router();

const AI_MODEL = 'gemini-2.5-flash';
const TRANSACTION_TYPE = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
};
const SALE_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
};

const getUserId = (req) => Number(req.user?.id);

const fetchActiveEntities = async (table, userId) => {
  const result = await pool.query(
    `SELECT * FROM ${table}
     WHERE user_id = $1
       AND deleted_at IS NULL
     ORDER BY id ASC`,
    [userId],
  );

  return result.rows.map(rowToEntity);
};

const ensureAiConfigured = () => {
  if (!process.env.API_KEY) {
    const error = new Error('IA nao configurada no servidor.');
    error.statusCode = 503;
    throw error;
  }
};

const getAiClient = () => {
  ensureAiConfigured();
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const extractJsonPayload = (rawText) => {
  const trimmed = String(rawText || '').trim();
  const withoutFences = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const firstBrace = withoutFences.indexOf('{');
  const lastBrace = withoutFences.lastIndexOf('}');
  const candidate =
    firstBrace >= 0 && lastBrace > firstBrace
      ? withoutFences.slice(firstBrace, lastBrace + 1)
      : withoutFences;

  return JSON.parse(candidate);
};

const toOverviewFallback = (text) => ({
  summary: text || 'Nao foi possivel estruturar a resposta da IA.',
  recommendations: text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*0-9.\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 3),
  opportunities: [],
});

const toProductFallback = (product, text) => ({
  productName: product.name,
  positioningSummary: text || 'Nao foi possivel estruturar a resposta da IA.',
  idealPriceRange: `Analise manual recomendada (preco atual: R$ ${product.sellingPrice.toFixed(2)})`,
  targetAudience: 'Nao identificado automaticamente.',
  bestSalesChannels: [],
  suggestedMaterials: [],
  marketingHighlights: [],
  nextSteps: [],
  warnings: ['A resposta da IA veio fora do formato estruturado esperado.'],
});

const askForJson = async (prompt) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: AI_MODEL,
    contents: prompt,
  });

  return String(response.text || '').trim();
};

const buildOverviewPrompt = ({ revenue, expenses, profit, totalSales, pendingSales, lowStockProducts, topProducts }) => `
Voce e um consultor senior de marketing e operacao para pequenos negocios brasileiros de personalizados e artesanato.
Analise os dados abaixo e responda apenas com JSON valido.

Contexto:
- Faturamento total: R$ ${revenue.toFixed(2)}
- Despesas totais: R$ ${expenses.toFixed(2)}
- Lucro estimado: R$ ${profit.toFixed(2)}
- Pedidos totais: ${totalSales}
- Pedidos pendentes: ${pendingSales}
- Produtos com estoque baixo: ${lowStockProducts.length ? lowStockProducts.join(', ') : 'Nenhum'}
- Produtos com mais giro: ${topProducts.length ? topProducts.join(', ') : 'Sem historico suficiente'}

Estrutura JSON obrigatoria:
{
  "summary": "resumo executivo em 2 ou 3 frases",
  "recommendations": ["acao 1", "acao 2", "acao 3"],
  "opportunities": ["oportunidade 1", "oportunidade 2"]
}

Regras:
- Responda em portugues do Brasil.
- Seja especifico e pratico.
- Nao use markdown.
- Nao inclua texto fora do JSON.
`;

const buildProductPrompt = ({ product, productOrders, paidOrders, totalUnitsSold, grossRevenue, recentOrders }) => `
Voce e um consultor senior de marketing para negocios brasileiros de artesanato e produtos personalizados.
Analise o produto abaixo e responda apenas com JSON valido.

Produto:
- Nome: ${product.name}
- Preco atual: R$ ${product.sellingPrice.toFixed(2)}
- Custo base atual: R$ ${product.baseCost.toFixed(2)}
- Estoque atual: ${product.stockCount}
- Descricao cadastrada: ${product.description || 'Sem descricao'}

Historico:
- Pedidos totais do produto: ${productOrders.length}
- Pedidos pagos: ${paidOrders.length}
- Unidades vendidas em pedidos pagos: ${totalUnitsSold}
- Receita bruta do produto em pedidos pagos: R$ ${grossRevenue.toFixed(2)}
- Pedidos recentes: ${
    recentOrders.length
      ? recentOrders
          .map(
            (order) =>
              `${order.quantity} unidade(s) por R$ ${Number(order.totalAmount || 0).toFixed(2)} em ${new Date(order.date).toLocaleDateString('pt-BR')}`,
          )
          .join('; ')
      : 'Sem historico recente'
  }

Objetivo:
- Avaliar preco final do produto.
- Identificar publico ideal.
- Indicar melhores canais e locais de venda.
- Sugerir materia-prima ou insumos provaveis para produzir esse produto.
- Estimar faixa de preco da materia-prima em BRL.

Estrutura JSON obrigatoria:
{
  "productName": "nome do produto",
  "positioningSummary": "resumo de posicionamento em 2 ou 3 frases",
  "idealPriceRange": "faixa de preco recomendada em BRL",
  "targetAudience": "descricao do publico ideal",
  "bestSalesChannels": ["canal 1", "canal 2", "canal 3"],
  "suggestedMaterials": [
    {
      "name": "material",
      "estimatedPriceRange": "faixa estimada em BRL",
      "purpose": "para que serve",
      "notes": "observacao curta"
    }
  ],
  "marketingHighlights": ["gancho 1", "gancho 2", "gancho 3"],
  "nextSteps": ["proxima acao 1", "proxima acao 2", "proxima acao 3"],
  "warnings": ["risco ou premissa 1", "risco ou premissa 2"]
}

Regras:
- Se faltar dado, assuma o contexto mais provavel para artesanato/personalizados no Brasil e deixe isso claro em "warnings".
- Nao use markdown.
- Nao inclua texto fora do JSON.
`;

router.post('/overview', async (req, res, next) => {
  const userId = getUserId(req);

  try {
    const [orders, products, transactions] = await Promise.all([
      fetchActiveEntities('orders', userId),
      fetchActiveEntities('products', userId),
      fetchActiveEntities('transactions', userId),
    ]);

    const revenue = transactions
      .filter((transaction) => transaction.type === TRANSACTION_TYPE.INCOME)
      .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
    const expenses = transactions
      .filter((transaction) => transaction.type === TRANSACTION_TYPE.EXPENSE)
      .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
    const profit = revenue - expenses;
    const pendingSales = orders.filter((order) => order.status === SALE_STATUS.PENDING).length;
    const lowStockProducts = products
      .filter((product) => Number(product.stockCount || 0) < 5)
      .map((product) => product.name)
      .slice(0, 5);

    const salesByProduct = new Map();
    for (const order of orders) {
      const current = salesByProduct.get(order.productId) || 0;
      salesByProduct.set(order.productId, current + Number(order.quantity || 0));
    }

    const topProducts = products
      .map((product) => ({
        name: product.name,
        units: salesByProduct.get(product.id) || 0,
      }))
      .filter((entry) => entry.units > 0)
      .sort((left, right) => right.units - left.units)
      .slice(0, 3)
      .map((entry) => `${entry.name} (${entry.units} unid.)`);

    const rawResponse = await askForJson(
      buildOverviewPrompt({
        revenue,
        expenses,
        profit,
        totalSales: orders.length,
        pendingSales,
        lowStockProducts,
        topProducts,
      }),
    );

    let payload;
    try {
      payload = extractJsonPayload(rawResponse);
    } catch (_error) {
      payload = toOverviewFallback(rawResponse);
    }

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.post('/product-analysis', async (req, res, next) => {
  const userId = getUserId(req);
  const productId = Number(req.body?.productId);

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ error: 'Produto invalido.' });
  }

  try {
    const [products, orders] = await Promise.all([
      fetchActiveEntities('products', userId),
      fetchActiveEntities('orders', userId),
    ]);

    const product = products.find((item) => Number(item.id) === productId);
    if (!product) {
      return res.status(404).json({ error: 'Produto nao encontrado.' });
    }

    const productOrders = orders.filter((order) => Number(order.productId) === productId);
    const paidOrders = productOrders.filter((order) => order.status === SALE_STATUS.PAID);
    const totalUnitsSold = paidOrders.reduce((total, order) => total + Number(order.quantity || 0), 0);
    const grossRevenue = paidOrders.reduce((total, order) => total + Number(order.totalAmount || 0), 0);
    const recentOrders = productOrders
      .slice()
      .sort((left, right) => Number(right.date || 0) - Number(left.date || 0))
      .slice(0, 5);

    const rawResponse = await askForJson(
      buildProductPrompt({
        product,
        productOrders,
        paidOrders,
        totalUnitsSold,
        grossRevenue,
        recentOrders,
      }),
    );

    let payload;
    try {
      payload = extractJsonPayload(rawResponse);
    } catch (_error) {
      payload = toProductFallback(product, rawResponse);
    }

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

export default router;

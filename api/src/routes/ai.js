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

const fetchSavedProductAnalyses = async (userId) => {
  const result = await pool.query(
    `SELECT
       a.product_id,
       a.analysis,
       a.created_at,
       a.updated_at,
       p.data->>'name' AS product_name,
       p.data->>'baseCost' AS product_base_cost,
       p.data->>'sellingPrice' AS product_selling_price
     FROM ai_product_analyses a
     INNER JOIN products p
       ON p.id = a.product_id
     WHERE a.user_id = $1
       AND p.user_id = $1
       AND p.deleted_at IS NULL
     ORDER BY a.updated_at DESC`,
    [userId],
  );

  return result.rows.map((row) => ({
    productId: Number(row.product_id),
    productName: row.product_name || 'Produto sem nome',
    analysis: buildNormalizedProductAnalysis(
      {
        name: row.product_name || 'Produto sem nome',
        baseCost: Number(row.product_base_cost || 0),
        sellingPrice: Number(row.product_selling_price || 0),
      },
      row.analysis || {},
    ),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
};

const saveProductAnalysis = async ({ userId, productId, analysis }) => {
  const now = Date.now();

  const result = await pool.query(
    `INSERT INTO ai_product_analyses (user_id, product_id, analysis, created_at, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, $4)
     ON CONFLICT (user_id, product_id)
     DO UPDATE SET
       analysis = EXCLUDED.analysis,
       updated_at = EXCLUDED.updated_at
     RETURNING created_at, updated_at`,
    [userId, productId, analysis, now],
  );

  return {
    createdAt: Number(result.rows[0]?.created_at || now),
    updatedAt: Number(result.rows[0]?.updated_at || now),
  };
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

const parseProviderPayload = (value) => {
  try {
    return JSON.parse(String(value || ''));
  } catch (_error) {
    return null;
  }
};

const normalizeAiError = (error) => {
  const rawMessage = String(error?.message || '');
  const providerPayload = parseProviderPayload(rawMessage);
  const providerMessage =
    providerPayload?.error?.message && typeof providerPayload.error.message === 'string'
      ? providerPayload.error.message
      : rawMessage;

  if (/reported as leaked/i.test(providerMessage)) {
    const mappedError = new Error(
      'A chave da IA foi bloqueada pelo Google por vazamento. Gere uma nova API_KEY e atualize o EasyPanel.',
    );
    mappedError.statusCode = 503;
    return mappedError;
  }

  if (/api key not valid|invalid api key|permission_denied/i.test(providerMessage)) {
    const mappedError = new Error(
      'A IA nao conseguiu autenticar no Google. Revise a API_KEY configurada no servidor.',
    );
    mappedError.statusCode = 503;
    return mappedError;
  }

  if (/quota|rate limit|resource has been exhausted/i.test(providerMessage)) {
    const mappedError = new Error(
      'A cota da IA foi atingida no provedor. Aguarde ou ajuste o faturamento da chave.',
    );
    mappedError.statusCode = 503;
    return mappedError;
  }

  const mappedError = new Error('Falha ao consultar a IA. Revise a configuracao da API_KEY e tente novamente.');
  mappedError.statusCode = 502;
  return mappedError;
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

const calculateProfitMarginPercentage = (baseCost, sellingPrice) => {
  const normalizedBaseCost = Number(baseCost || 0);
  const normalizedSellingPrice = Number(sellingPrice || 0);

  if (
    !Number.isFinite(normalizedBaseCost) ||
    !Number.isFinite(normalizedSellingPrice) ||
    normalizedBaseCost <= 0 ||
    normalizedSellingPrice <= 0
  ) {
    return 'Nao informado';
  }

  return `${(((normalizedSellingPrice - normalizedBaseCost) / normalizedBaseCost) * 100).toFixed(1)}%`;
};

const buildNormalizedProductAnalysis = (product, payload = {}) => ({
  productName: payload.productName || product.name || 'Produto sem nome',
  positioningSummary: payload.positioningSummary || '',
  idealPriceRange: payload.idealPriceRange || '',
  profitMarginPercentage:
    payload.profitMarginPercentage ||
    calculateProfitMarginPercentage(product.baseCost, product.sellingPrice),
  targetAudience: payload.targetAudience || '',
  bestSalesChannels: Array.isArray(payload.bestSalesChannels) ? payload.bestSalesChannels : [],
  suggestedMaterials: Array.isArray(payload.suggestedMaterials) ? payload.suggestedMaterials : [],
  marketingHighlights: Array.isArray(payload.marketingHighlights) ? payload.marketingHighlights : [],
  nextSteps: Array.isArray(payload.nextSteps) ? payload.nextSteps : [],
  warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
});

const toProductFallback = (product, text) => ({
  productName: product.name,
  positioningSummary: text || 'Nao foi possivel estruturar a resposta da IA.',
  idealPriceRange: `Analise manual recomendada (preco atual: R$ ${product.sellingPrice.toFixed(2)})`,
  profitMarginPercentage: calculateProfitMarginPercentage(product.baseCost, product.sellingPrice),
  targetAudience: 'Nao identificado automaticamente.',
  bestSalesChannels: [],
  suggestedMaterials: [],
  marketingHighlights: [],
  nextSteps: [],
  warnings: ['A resposta da IA veio fora do formato estruturado esperado.'],
});

const normalizeStoredProductAnalysis = (product, payload, timestamps = {}) => ({
  productId: Number(product.id),
  productName: payload.productName || product.name,
  analysis: buildNormalizedProductAnalysis(product, payload),
  createdAt: Number(timestamps.createdAt || Date.now()),
  updatedAt: Number(timestamps.updatedAt || Date.now()),
});

const parseOptionalMoneyValue = (value) => {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  const normalizedValue = Number(String(value).replace(',', '.'));
  return Number.isFinite(normalizedValue) ? normalizedValue : NaN;
};

const parseSuppliesText = (value) =>
  String(value || '')
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((name) => ({ name }));

const askForJson = async (prompt) => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: prompt,
    });

    return String(response.text || '').trim();
  } catch (error) {
    throw normalizeAiError(error);
  }
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
- Ganho atual sobre o custo: ${calculateProfitMarginPercentage(product.baseCost, product.sellingPrice)}
- Estoque atual: ${product.stockCount}
- Descricao cadastrada: ${product.description || 'Sem descricao'}
- Insumos cadastrados: ${
    Array.isArray(product.supplies) && product.supplies.length
      ? product.supplies
          .map((item) =>
            [item.name, item.quantity, item.unit].filter(Boolean).join(' ')
          )
          .join('; ')
      : 'Sem insumos cadastrados'
  }

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
  "profitMarginPercentage": "percentual de ganho sobre o custo atual",
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

    const normalizedAnalysis = normalizeStoredProductAnalysis(product, payload);
    const timestamps = await saveProductAnalysis({
      userId,
      productId,
      analysis: normalizedAnalysis.analysis,
    });

    res.json({
      ...normalizedAnalysis,
      createdAt: Number(timestamps.createdAt || normalizedAnalysis.createdAt),
      updatedAt: Number(timestamps.updatedAt || normalizedAnalysis.updatedAt),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/product-analysis/search', async (req, res, next) => {
  const query = String(req.body?.query || '').trim();
  const baseCost = parseOptionalMoneyValue(req.body?.baseCost);
  const sellingPrice = parseOptionalMoneyValue(req.body?.sellingPrice);

  if (query.length < 2) {
    return res.status(400).json({ error: 'Informe um produto para a busca livre.' });
  }

  if (Number.isNaN(baseCost) || Number.isNaN(sellingPrice)) {
    return res.status(400).json({ error: 'Valores invalidos para custo ou venda.' });
  }

  try {
    const product = {
      id: 0,
      name: query,
      baseCost,
      sellingPrice,
      stockCount: 0,
      description: String(req.body?.description || '').trim(),
      supplies: parseSuppliesText(req.body?.suppliesText),
    };

    const rawResponse = await askForJson(
      buildProductPrompt({
        product,
        productOrders: [],
        paidOrders: [],
        totalUnitsSold: 0,
        grossRevenue: 0,
        recentOrders: [],
      }),
    );

    let payload;
    try {
      payload = extractJsonPayload(rawResponse);
    } catch (_error) {
      payload = toProductFallback(product, rawResponse);
    }

    const now = Date.now();
    const normalizedAnalysis = normalizeStoredProductAnalysis(product, payload, {
      createdAt: now,
      updatedAt: now,
    });
    normalizedAnalysis.analysis.warnings = [
      'Analise gerada por busca livre. Cadastre o produto se quiser salvar o historico.',
      ...normalizedAnalysis.analysis.warnings,
    ];

    res.json(normalizedAnalysis);
  } catch (error) {
    next(error);
  }
});

router.get('/product-analyses', async (req, res, next) => {
  const userId = getUserId(req);

  try {
    const items = await fetchSavedProductAnalyses(userId);
    res.json(items);
  } catch (error) {
    next(error);
  }
});

export default router;

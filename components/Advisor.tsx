import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightIcon,
  BoxIcon,
  BulbIcon,
  ChartUpIcon,
  RobotIcon,
  SparklesIcon,
  XIcon,
} from './AppIcons';
import { ProductRepo } from '../repositories';
import { AdvisorService } from '../services/AdvisorService';
import {
  AiBusinessInsight,
  Product,
  StoredAiProductAnalysis,
} from '../types';

const formatDateTime = (timestamp: number) =>
  new Date(timestamp).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const parseProductId = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

const parseOptionalMoneyInput = (value: string) => {
  const normalized = String(value || '').trim().replace(',', '.');
  if (!normalized) return undefined;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const AnalysisDetails: React.FC<{ item: StoredAiProductAnalysis }> = ({ item }) => {
  const { analysis } = item;

  return (
    <div className="space-y-5">
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Produto analisado
            </div>
            <h4 className="text-xl font-black text-slate-950">{item.productName}</h4>
          </div>
          <div className="text-sm font-medium text-slate-400">
            Atualizado em {formatDateTime(item.updatedAt)}
          </div>
        </div>
        <p className="text-slate-600 mt-3 leading-7">{analysis.positioningSummary}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <h5 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">
            Preco final sugerido
          </h5>
          <p className="text-slate-900 font-black text-lg">{analysis.idealPriceRange}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <h5 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">
            Ganho sobre o custo
          </h5>
          <p className="text-emerald-600 font-black text-lg">{analysis.profitMarginPercentage}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl p-5">
        <h5 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">
          Publico ideal
        </h5>
        <p className="text-slate-700 leading-7">{analysis.targetAudience}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <h5 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">
            Melhores canais de venda
          </h5>
          <ul className="space-y-3">
            {analysis.bestSalesChannels.map((channel, index) => (
              <li key={`${channel}-${index}`} className="flex items-start gap-3 text-slate-700">
                <span className="mt-1 w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                <span>{channel}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <h5 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">
            Ganchos de marketing
          </h5>
          <ul className="space-y-3">
            {analysis.marketingHighlights.map((itemText, index) => (
              <li key={`${itemText}-${index}`} className="flex items-start gap-3 text-slate-700">
                <ArrowRightIcon className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                <span>{itemText}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl p-5">
        <h5 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">
          Materia-prima sugerida
        </h5>
        <div className="space-y-3">
          {analysis.suggestedMaterials.length > 0 ? (
            analysis.suggestedMaterials.map((material, index) => (
              <div
                key={`${material.name}-${index}`}
                className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
              >
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <strong className="text-slate-950">{material.name}</strong>
                  <span className="text-sm font-bold text-indigo-600">
                    {material.estimatedPriceRange}
                  </span>
                </div>
                <p className="text-slate-600 mt-2">{material.purpose}</p>
                <p className="text-sm text-slate-400 mt-1">{material.notes}</p>
              </div>
            ))
          ) : (
            <p className="text-slate-400">A IA nao retornou materiais para este produto.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <h5 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">
            Proximos passos
          </h5>
          <ul className="space-y-3">
            {analysis.nextSteps.map((step, index) => (
              <li key={`${step}-${index}`} className="flex items-start gap-3 text-slate-700">
                <span className="mt-1 w-2 h-2 rounded-full bg-slate-900 shrink-0"></span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h5 className="text-sm font-black uppercase tracking-widest text-amber-700 mb-3">
            Premissas e alertas
          </h5>
          <ul className="space-y-3">
            {analysis.warnings.length > 0 ? (
              analysis.warnings.map((warning, index) => (
                <li key={`${warning}-${index}`} className="text-amber-800">
                  {warning}
                </li>
              ))
            ) : (
              <li className="text-amber-800">Nenhum alerta adicional nesta leitura.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export const Advisor: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [analysisMode, setAnalysisMode] = useState<'catalog' | 'search'>('catalog');
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [selectedSavedProductId, setSelectedSavedProductId] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBaseCost, setSearchBaseCost] = useState('');
  const [searchSellingPrice, setSearchSellingPrice] = useState('');
  const [searchDescription, setSearchDescription] = useState('');
  const [searchSuppliesText, setSearchSuppliesText] = useState('');
  const [overviewInsight, setOverviewInsight] = useState<AiBusinessInsight | null>(null);
  const [latestProductAnalysis, setLatestProductAnalysis] = useState<StoredAiProductAnalysis | null>(null);
  const [latestAnalysisSource, setLatestAnalysisSource] = useState<'catalog' | 'search' | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<StoredAiProductAnalysis[]>([]);
  const [modalAnalysis, setModalAnalysis] = useState<StoredAiProductAnalysis | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [loadingSavedAnalyses, setLoadingSavedAnalyses] = useState(false);
  const [error, setError] = useState('');

  const savedAnalysisLookup = useMemo(
    () =>
      new Map(savedAnalyses.map((item) => [item.productId, item])),
    [savedAnalyses],
  );

  const loadSavedAnalyses = async () => {
    setLoadingSavedAnalyses(true);
    try {
      const items = await AdvisorService.getSavedProductAnalyses();
      setSavedAnalyses(items);

      if (items.length > 0) {
        setSelectedSavedProductId((current) =>
          current && items.some((item) => item.productId === current) ? current : items[0].productId,
        );
      } else {
        setSelectedSavedProductId(0);
      }
    } catch (loadError: any) {
      setError(loadError?.message || 'Nao foi possivel carregar as analises salvas.');
    } finally {
      setLoadingSavedAnalyses(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [productList] = await Promise.all([ProductRepo.getAllActive(), loadSavedAnalyses()]);
        setProducts(productList);
        if (productList.length > 0) {
          setSelectedProductId(productList[0].id || 0);
        }
      } catch (loadError: any) {
        setError(loadError?.message || 'Nao foi possivel carregar os dados da IA.');
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    if (!modalAnalysis) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalAnalysis]);

  const handleOverviewInsight = async () => {
    setError('');
    setLoadingOverview(true);
    try {
      const analysis = await AdvisorService.getBusinessInsight();
      setOverviewInsight(analysis);
    } catch (requestError: any) {
      setError(requestError?.message || 'Nao foi possivel gerar o insight agora.');
    } finally {
      setLoadingOverview(false);
    }
  };

  const handleProductAnalysis = async () => {
    setError('');
    setLoadingProduct(true);
    try {
      if (analysisMode === 'catalog') {
        if (!selectedProductId) {
          setError('Selecione um produto para analisar.');
          return;
        }

        const storedAnalysis = await AdvisorService.analyzeProduct(selectedProductId);
        setLatestProductAnalysis(storedAnalysis);
        setLatestAnalysisSource('catalog');
        setSelectedSavedProductId(storedAnalysis.productId);
        setSavedAnalyses((current) => {
          const next = current.filter((item) => item.productId !== storedAnalysis.productId);
          return [storedAnalysis, ...next].sort((left, right) => right.updatedAt - left.updatedAt);
        });
      } else {
        if (!searchQuery.trim()) {
          setError('Informe o produto que deseja pesquisar na busca livre.');
          return;
        }

        const storedAnalysis = await AdvisorService.analyzeFreeSearchProduct({
          query: searchQuery.trim(),
          baseCost: parseOptionalMoneyInput(searchBaseCost),
          sellingPrice: parseOptionalMoneyInput(searchSellingPrice),
          description: searchDescription.trim() || undefined,
          suppliesText: searchSuppliesText.trim() || undefined,
        });

        setLatestProductAnalysis(storedAnalysis);
        setLatestAnalysisSource('search');
      }
    } catch (requestError: any) {
      setError(requestError?.message || 'Nao foi possivel analisar o produto agora.');
    } finally {
      setLoadingProduct(false);
    }
  };

  const handleOpenSavedAnalysis = () => {
    if (!selectedSavedProductId) {
      setError('Selecione um produto com analise salva.');
      return;
    }

    const storedAnalysis = savedAnalysisLookup.get(selectedSavedProductId);
    if (!storedAnalysis) {
      setError('A analise selecionada nao foi encontrada.');
      return;
    }

    setModalAnalysis(storedAnalysis);
  };

  return (
    <>
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-slate-950 text-white p-8 rounded-[2.5rem] shadow-2xl overflow-hidden relative">
          <div className="relative z-10 max-w-2xl">
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-indigo-300/70">
              MyBizPro AI
            </span>
            <h2 className="text-3xl md:text-4xl font-black mt-3 mb-3 tracking-tight">
              Inteligencia comercial para vender melhor.
            </h2>
            <p className="text-slate-300 md:text-lg">
              Gere insights do negocio, salve leituras por produto e consulte essas analises sempre que precisar.
            </p>
          </div>
          <div className="absolute top-0 right-0 p-6 opacity-15 pointer-events-none">
            <RobotIcon className="w-28 h-28 md:w-36 md:h-36" />
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-5 py-4 rounded-2xl font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="bg-white border border-slate-100 shadow-sm rounded-[2rem] p-6 md:p-8 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500">
                  <ChartUpIcon className="w-4 h-4" />
                  <span>Panorama do negocio</span>
                </div>
                <h3 className="text-2xl font-black text-slate-950 mt-2">Insight geral</h3>
                <p className="text-slate-500 mt-2">
                  A IA resume seu momento atual e sugere acoes praticas para melhorar operacao e margem.
                </p>
              </div>
            </div>

            <button
              onClick={handleOverviewInsight}
              disabled={loadingOverview}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-60"
            >
              <SparklesIcon className="w-4 h-4" />
              <span>{loadingOverview ? 'Gerando insight...' : 'Gerar insight agora'}</span>
            </button>

            {overviewInsight && (
              <div className="space-y-5 pt-2">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                  <div className="flex items-center gap-2 text-slate-950 font-black mb-3">
                    <BulbIcon className="w-4 h-4 text-indigo-500" />
                    <span>Resumo executivo</span>
                  </div>
                  <p className="text-slate-600 leading-7">{overviewInsight.summary}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="bg-white border border-slate-100 rounded-2xl p-5">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">
                      Recomendacoes
                    </h4>
                    <ul className="space-y-3">
                      {overviewInsight.recommendations.map((item, index) => (
                        <li key={`${item}-${index}`} className="flex items-start gap-3 text-slate-700">
                          <span className="mt-1 w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-2xl p-5">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">
                      Oportunidades
                    </h4>
                    <ul className="space-y-3">
                      {overviewInsight.opportunities.length > 0 ? (
                        overviewInsight.opportunities.map((item, index) => (
                          <li key={`${item}-${index}`} className="flex items-start gap-3 text-slate-700">
                            <ArrowRightIcon className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-slate-400">
                          Sem oportunidades adicionais retornadas nesta analise.
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="bg-white border border-slate-100 shadow-sm rounded-[2rem] p-6 md:p-8 space-y-5">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500">
                <BoxIcon className="w-4 h-4" />
                <span>Leitura por produto</span>
              </div>
              <h3 className="text-2xl font-black text-slate-950 mt-2">Analise de marketing</h3>
              <p className="text-slate-500 mt-2">
                Gere uma nova analise com IA ou abra uma leitura salva de um produto ja analisado.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">
                    Nova analise
                  </h4>
                  <p className="text-sm text-slate-500 mt-2">
                    Analise um produto cadastrado ou use uma busca livre para estudar um produto que ainda nao esta no catalogo.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setAnalysisMode('catalog')}
                    className={`rounded-xl px-4 py-2.5 text-sm font-black transition-all ${
                      analysisMode === 'catalog'
                        ? 'bg-slate-950 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Produto cadastrado
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalysisMode('search')}
                    className={`rounded-xl px-4 py-2.5 text-sm font-black transition-all ${
                      analysisMode === 'search'
                        ? 'bg-slate-950 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Busca livre
                  </button>
                </div>

                {analysisMode === 'catalog' ? (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-500">
                      Se rodar novamente para o mesmo produto, a analise anterior sera substituida pela nova.
                    </p>

                    <div>
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">
                        Produto
                      </label>
                      <select
                        value={selectedProductId}
                        onChange={(event) => setSelectedProductId(parseProductId(event.target.value))}
                        className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {products.length === 0 ? (
                          <option value="0">Nenhum produto cadastrado</option>
                        ) : (
                          products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">
                        Busca do produto
                      </label>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: squeezes personalizados para academia"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">
                          Custo de producao (R$)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={searchBaseCost}
                          onChange={(event) => setSearchBaseCost(event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Opcional"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">
                          Valor final (R$)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={searchSellingPrice}
                          onChange={(event) => setSearchSellingPrice(event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Opcional"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">
                        Descricao
                      </label>
                      <textarea
                        value={searchDescription}
                        onChange={(event) => setSearchDescription(event.target.value)}
                        className="w-full min-h-28 rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 font-medium outline-none resize-y focus:ring-2 focus:ring-indigo-500"
                        placeholder="Explique o produto, acabamento, proposta e contexto de uso."
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">
                        Insumos principais
                      </label>
                      <textarea
                        value={searchSuppliesText}
                        onChange={(event) => setSearchSuppliesText(event.target.value)}
                        className="w-full min-h-24 rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 font-medium outline-none resize-y focus:ring-2 focus:ring-indigo-500"
                        placeholder="Separe por virgula ou linha. Ex: vidro 250ml, etiqueta adesiva, fita de cetim"
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleProductAnalysis}
                  disabled={loadingProduct || (analysisMode === 'catalog' && products.length === 0)}
                  className="inline-flex items-center gap-2 bg-slate-950 text-white px-5 py-3 rounded-2xl font-bold shadow-lg hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-60"
                >
                  <SparklesIcon className="w-4 h-4" />
                  <span>
                    {loadingProduct
                      ? 'Analisando produto...'
                      : analysisMode === 'catalog'
                        ? 'Analisar produto com IA'
                        : 'Analisar busca livre com IA'}
                  </span>
                </button>
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">
                      Analises salvas
                    </h4>
                    <span className="text-xs font-bold text-slate-400">
                      {loadingSavedAnalyses ? 'Carregando...' : `${savedAnalyses.length} salvas`}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-2">
                    Selecione um produto que ja possui analise para abrir a leitura em destaque.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">
                    Produto com analise
                  </label>
                  <select
                    value={selectedSavedProductId}
                    onChange={(event) => setSelectedSavedProductId(parseProductId(event.target.value))}
                    className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={savedAnalyses.length === 0}
                  >
                    {savedAnalyses.length === 0 ? (
                      <option value="0">Nenhuma analise salva ainda</option>
                    ) : (
                      savedAnalyses.map((item) => (
                        <option key={item.productId} value={item.productId}>
                          {item.productName}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <button
                  onClick={handleOpenSavedAnalysis}
                  disabled={savedAnalyses.length === 0}
                  className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-900 px-5 py-3 rounded-2xl font-bold shadow-sm hover:border-indigo-300 hover:text-indigo-600 transition-all active:scale-95 disabled:opacity-60"
                >
                  <ArrowRightIcon className="w-4 h-4" />
                  <span>Ver analise salva</span>
                </button>
              </div>
            </div>

            {analysisMode === 'catalog' && products.length === 0 && (
              <p className="text-sm text-slate-400">
                Cadastre pelo menos um produto para usar esta analise.
              </p>
            )}

            {latestProductAnalysis && (
              <div className="space-y-5 pt-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">
                      <SparklesIcon className="w-4 h-4" />
                      <span>Ultima analise gerada</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">
                      {latestAnalysisSource === 'catalog'
                        ? 'Esta leitura ja foi salva e pode ser reaberta depois em analises salvas.'
                        : 'Esta leitura veio de busca livre e nao foi salva automaticamente.'}
                    </p>
                  </div>
                  <button
                    onClick={() => setModalAnalysis(latestProductAnalysis)}
                    className="inline-flex items-center gap-2 bg-slate-950 text-white px-4 py-2.5 rounded-2xl font-bold shadow-lg hover:bg-slate-800 transition-all active:scale-95"
                  >
                    <ArrowRightIcon className="w-4 h-4" />
                    <span>Abrir grande</span>
                  </button>
                </div>

                <AnalysisDetails item={latestProductAnalysis} />
              </div>
            )}
          </section>
        </div>
      </div>

      {modalAnalysis && (
        <div
          className="fixed inset-0 z-[200] bg-slate-950/45 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setModalAnalysis(null)}
        >
          <div
            className="w-[80vw] h-[80vh] max-w-6xl bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-slate-100">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500">
                    Analise salva
                  </div>
                  <h3 className="text-2xl font-black text-slate-950 mt-2">
                    {modalAnalysis.productName}
                  </h3>
                </div>
                <button
                  onClick={() => setModalAnalysis(null)}
                  className="w-11 h-11 rounded-2xl border border-slate-200 text-slate-500 hover:text-slate-950 hover:border-slate-300 transition-colors flex items-center justify-center"
                  title="Fechar"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar p-6 md:p-8">
                <AnalysisDetails item={modalAnalysis} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

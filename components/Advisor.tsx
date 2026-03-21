import React, { useEffect, useState } from 'react';
import {
  ArrowRightIcon,
  BoxIcon,
  BulbIcon,
  ChartUpIcon,
  RobotIcon,
  SparklesIcon,
} from './AppIcons';
import { ProductRepo } from '../repositories';
import { AdvisorService } from '../services/AdvisorService';
import { AiBusinessInsight, AiProductAnalysis, Product } from '../types';

export const Advisor: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [overviewInsight, setOverviewInsight] = useState<AiBusinessInsight | null>(null);
  const [productAnalysis, setProductAnalysis] = useState<AiProductAnalysis | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const list = await ProductRepo.getAllActive();
        setProducts(list);
        if (list.length > 0) {
          setSelectedProductId(list[0].id || 0);
        }
      } catch (loadError: any) {
        setError(loadError?.message || 'Nao foi possivel carregar seus produtos.');
      }
    };

    loadProducts();
  }, []);

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
    if (!selectedProductId) {
      setError('Selecione um produto para analisar.');
      return;
    }

    setError('');
    setLoadingProduct(true);
    try {
      const analysis = await AdvisorService.analyzeProduct(selectedProductId);
      setProductAnalysis(analysis);
    } catch (requestError: any) {
      setError(requestError?.message || 'Nao foi possivel analisar o produto agora.');
    } finally {
      setLoadingProduct(false);
    }
  };

  return (
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
            Gere insights do negocio e peça uma leitura de marketing para qualquer produto do seu catalogo.
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
                      <li className="text-slate-400">Sem oportunidades adicionais retornadas nesta analise.</li>
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
              Selecione um item cadastrado para receber orientacao de preco, publico, canais e materia-prima.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">
                Produto
              </label>
              <select
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(parseInt(event.target.value, 10))}
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

            <button
              onClick={handleProductAnalysis}
              disabled={loadingProduct || products.length === 0}
              className="inline-flex items-center gap-2 bg-slate-950 text-white px-5 py-3 rounded-2xl font-bold shadow-lg hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-60"
            >
              <SparklesIcon className="w-4 h-4" />
              <span>{loadingProduct ? 'Analisando produto...' : 'Analisar produto com IA'}</span>
            </button>

            {products.length === 0 && (
              <p className="text-sm text-slate-400">
                Cadastre pelo menos um produto para usar esta analise.
              </p>
            )}
          </div>

          {productAnalysis && (
            <div className="space-y-5 pt-2">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  Produto analisado
                </div>
                <h4 className="text-xl font-black text-slate-950">{productAnalysis.productName}</h4>
                <p className="text-slate-600 mt-3 leading-7">{productAnalysis.positioningSummary}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-white border border-slate-100 rounded-2xl p-5">
                  <h5 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">
                    Preco final sugerido
                  </h5>
                  <p className="text-slate-900 font-black text-lg">{productAnalysis.idealPriceRange}</p>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-5">
                  <h5 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">
                    Publico ideal
                  </h5>
                  <p className="text-slate-700 leading-7">{productAnalysis.targetAudience}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-white border border-slate-100 rounded-2xl p-5">
                  <h5 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">
                    Melhores canais de venda
                  </h5>
                  <ul className="space-y-3">
                    {productAnalysis.bestSalesChannels.map((item, index) => (
                      <li key={`${item}-${index}`} className="flex items-start gap-3 text-slate-700">
                        <span className="mt-1 w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl p-5">
                  <h5 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">
                    Ganchos de marketing
                  </h5>
                  <ul className="space-y-3">
                    {productAnalysis.marketingHighlights.map((item, index) => (
                      <li key={`${item}-${index}`} className="flex items-start gap-3 text-slate-700">
                        <ArrowRightIcon className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                        <span>{item}</span>
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
                  {productAnalysis.suggestedMaterials.length > 0 ? (
                    productAnalysis.suggestedMaterials.map((material, index) => (
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
                    {productAnalysis.nextSteps.map((item, index) => (
                      <li key={`${item}-${index}`} className="flex items-start gap-3 text-slate-700">
                        <span className="mt-1 w-2 h-2 rounded-full bg-slate-900 shrink-0"></span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                  <h5 className="text-sm font-black uppercase tracking-widest text-amber-700 mb-3">
                    Premissas e alertas
                  </h5>
                  <ul className="space-y-3">
                    {productAnalysis.warnings.length > 0 ? (
                      productAnalysis.warnings.map((item, index) => (
                        <li key={`${item}-${index}`} className="text-amber-800">
                          {item}
                        </li>
                      ))
                    ) : (
                      <li className="text-amber-800">Nenhum alerta adicional nesta leitura.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

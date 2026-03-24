import React, { useEffect, useMemo, useState } from 'react';
import { BoxIcon, EditIcon, SparklesIcon, TrashIcon, XIcon } from './AppIcons';
import { ProductRepo } from '../repositories';
import { Product, ProductSupply } from '../types';

interface ProductFormState {
  name: string;
  stockCount: string;
  baseCost: string;
  sellingPrice: string;
  description: string;
  supplies: ProductSupply[];
}

const emptyProductForm = (): ProductFormState => ({
  name: '',
  stockCount: '',
  baseCost: '',
  sellingPrice: '',
  description: '',
  supplies: [],
});

const toInputValue = (value?: number) =>
  Number.isFinite(value) ? String(value) : '';

const mapProductToForm = (product: Product): ProductFormState => ({
  name: product.name || '',
  stockCount: toInputValue(product.stockCount),
  baseCost: toInputValue(product.baseCost),
  sellingPrice: toInputValue(product.sellingPrice),
  description: product.description || '',
  supplies: Array.isArray(product.supplies)
    ? product.supplies.map((item) => ({
        name: item.name || '',
        quantity: item.quantity || '',
        unit: item.unit || '',
      }))
    : [],
});

const parseIntegerOrZero = (value: string) => {
  const normalized = String(value || '').trim();
  if (!normalized) return 0;

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseFloatOrZero = (value: string) => {
  const normalized = String(value || '').trim().replace(',', '.');
  if (!normalized) return 0;

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sanitizeSupplies = (supplies: ProductSupply[]) =>
  supplies
    .map((item) => ({
      name: String(item.name || '').trim(),
      quantity: String(item.quantity || '').trim(),
      unit: String(item.unit || '').trim(),
    }))
    .filter((item) => item.name)
    .map((item) => ({
      name: item.name,
      ...(item.quantity ? { quantity: item.quantity } : {}),
      ...(item.unit ? { unit: item.unit } : {}),
    }));

export const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormState>(emptyProductForm);

  const loadProducts = async () => {
    const list = await ProductRepo.getAllActive();
    setProducts(
      [...list].sort((left, right) => right.updatedAt - left.updatedAt),
    );
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const totalSupplies = useMemo(
    () => products.reduce((sum, product) => sum + (product.supplies?.length || 0), 0),
    [products],
  );

  const resetForm = () => {
    setFormData(emptyProductForm());
    setEditingProduct(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData(mapProductToForm(product));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseForm = () => {
    setShowForm(false);
    resetForm();
  };

  const handleSupplyChange = (
    index: number,
    field: keyof ProductSupply,
    value: string,
  ) => {
    setFormData((current) => ({
      ...current,
      supplies: current.supplies.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const handleAddSupply = () => {
    setFormData((current) => ({
      ...current,
      supplies: [...current.supplies, { name: '', quantity: '', unit: '' }],
    }));
  };

  const handleRemoveSupply = (index: number) => {
    setFormData((current) => ({
      ...current,
      supplies: current.supplies.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        baseCost: parseFloatOrZero(formData.baseCost),
        sellingPrice: parseFloatOrZero(formData.sellingPrice),
        stockCount: parseIntegerOrZero(formData.stockCount),
        description: formData.description.trim() || undefined,
        supplies: sanitizeSupplies(formData.supplies),
      };

      if (editingProduct?.id) {
        await ProductRepo.update(editingProduct.id, payload);
      } else {
        await ProductRepo.create(payload);
      }

      handleCloseForm();
      await loadProducts();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Deseja excluir este produto?')) {
      await ProductRepo.softDelete(id);
      await loadProducts();
    }
  };

  const inputClasses =
    'w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-sm';

  return (
    <div className="space-y-6 animate-fadeIn pb-32 md:pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Produtos</h2>
          <p className="text-slate-500 text-sm font-medium">
            Cadastre, edite e organize seu catalogo com estoque, valor, descricao e insumos.
          </p>
        </div>

        <div className="flex flex-col md:items-end gap-2">
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Catalogo
            </p>
            <p className="text-sm font-bold text-slate-600">
              {products.length} produto(s) e {totalSupplies} insumo(s) cadastrado(s)
            </p>
          </div>

          <button
            onClick={showForm ? handleCloseForm : handleOpenCreate}
            className={`w-full md:w-auto px-6 py-3.5 rounded-2xl font-black transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2 ${
              showForm
                ? 'bg-slate-200 text-slate-700 shadow-none'
                : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'
            }`}
          >
            {showForm ? (
              <>
                <XIcon className="w-4 h-4" />
                <span>Cancelar</span>
              </>
            ) : (
              <>
                <SparklesIcon className="w-4 h-4" />
                <span>Novo Produto</span>
              </>
            )}
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-2xl space-y-6 max-w-4xl mx-auto animate-slideDown"
        >
          <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600">
              {editingProduct ? <EditIcon className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <p className="text-sm text-slate-500">
                {editingProduct
                  ? 'Atualize dados, estoque, valor e insumos do produto.'
                  : 'Preencha o cadastro completo do produto antes de salvar.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Nome do Produto
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                className={inputClasses}
                placeholder="Ex: Caneca personalizada BTS"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Quantidade em Estoque
              </label>
              <input
                type="number"
                min="0"
                value={formData.stockCount}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, stockCount: event.target.value }))
                }
                className={inputClasses}
                placeholder="0"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Custo de Producao (R$)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={formData.baseCost}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, baseCost: event.target.value }))
                }
                className={`${inputClasses} font-mono`}
                placeholder="Ex: 18.90"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Valor de Venda (R$)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={formData.sellingPrice}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, sellingPrice: event.target.value }))
                }
                className={`${inputClasses} font-mono`}
                placeholder="Ex: 39.90"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Descricao do Produto / Fabricacao
              </label>
              <textarea
                value={formData.description}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, description: event.target.value }))
                }
                className={`${inputClasses} min-h-32 resize-y`}
                placeholder="Descreva o produto, acabamento, observacoes e como ele e fabricado."
              />
            </div>
          </div>

          <div className="space-y-4 rounded-[1.75rem] border border-slate-100 bg-slate-50/70 p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-black text-slate-900">Insumos</h4>
                <p className="text-sm text-slate-500">
                  Liste os itens necessarios para produzir este produto.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddSupply}
                className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black hover:border-indigo-200 hover:text-indigo-600 transition-all active:scale-95"
              >
                + Adicionar insumo
              </button>
            </div>

            {formData.supplies.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm font-medium text-slate-400">
                Nenhum insumo informado ainda.
              </div>
            ) : (
              <div className="space-y-3">
                {formData.supplies.map((supply, index) => (
                  <div
                    key={`${index}-${supply.name}`}
                    className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_1fr_auto] gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Nome do Insumo
                      </label>
                      <input
                        type="text"
                        value={supply.name}
                        onChange={(event) => handleSupplyChange(index, 'name', event.target.value)}
                        className={inputClasses}
                        placeholder="Ex: Caneca branca 325ml"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Quantidade
                      </label>
                      <input
                        type="text"
                        value={supply.quantity || ''}
                        onChange={(event) =>
                          handleSupplyChange(index, 'quantity', event.target.value)
                        }
                        className={inputClasses}
                        placeholder="Ex: 1"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Unidade
                      </label>
                      <input
                        type="text"
                        value={supply.unit || ''}
                        onChange={(event) => handleSupplyChange(index, 'unit', event.target.value)}
                        className={inputClasses}
                        placeholder="Ex: unid."
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveSupply(index)}
                        className="w-full md:w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all active:scale-95 flex items-center justify-center"
                        title="Remover insumo"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-950 text-white py-4.5 rounded-2xl font-black hover:bg-slate-800 transition-all active:scale-[0.98] shadow-xl text-lg"
          >
            {loading
              ? 'Salvando...'
              : editingProduct
                ? 'Salvar Alteracoes do Produto'
                : 'Salvar Produto'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {products.map((product) => (
          <div
            key={product.id}
            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300"
          >
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="min-w-0">
                <h3 className="text-lg font-black text-slate-900 truncate" title={product.name}>
                  {product.name}
                </h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">
                  {product.supplies?.length || 0} insumo(s) vinculado(s)
                </p>
              </div>

              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => handleOpenEdit(product)}
                  className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all active:scale-90 flex items-center justify-center"
                  title="Editar produto"
                >
                  <EditIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => product.id && handleDelete(product.id)}
                  className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all active:scale-90 flex items-center justify-center"
                  title="Excluir produto"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="rounded-2xl bg-slate-50 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estoque</p>
                <p className={`text-xl font-black ${product.stockCount < 5 ? 'text-rose-500' : 'text-slate-900'}`}>
                  {product.stockCount}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Custo</p>
                <p className="text-lg font-black text-slate-900">R$ {product.baseCost.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl bg-indigo-50 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Valor</p>
                <p className="text-lg font-black text-indigo-600">R$ {product.sellingPrice.toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                  Descricao
                </p>
                <p className="text-sm text-slate-600 leading-6">
                  {product.description || 'Sem descricao cadastrada.'}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                  Insumos
                </p>
                {product.supplies?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {product.supplies.map((supply, index) => (
                      <span
                        key={`${product.id}-${index}-${supply.name}`}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
                      >
                        <span>{supply.name}</span>
                        {supply.quantity && (
                          <span className="text-slate-400">
                            {supply.quantity}
                            {supply.unit ? ` ${supply.unit}` : ''}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Nenhum insumo cadastrado.</p>
                )}
              </div>
            </div>
          </div>
        ))}

        {products.length === 0 && !showForm && (
          <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border border-dashed border-slate-300">
            <BoxIcon className="w-14 h-14 mx-auto mb-4 text-slate-300" />
            <h3 className="text-xl font-black text-slate-800">Nenhum produto cadastrado</h3>
            <p className="text-slate-400 font-medium max-w-sm mx-auto mt-2 px-6">
              Cadastre seu primeiro produto para controlar estoque, valor de venda, descricao e insumos.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-6 bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
            >
              Criar Primeiro Produto
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

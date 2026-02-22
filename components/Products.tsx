
import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { ProductRepo } from '../repositories';

export const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '', baseCost: 0, sellingPrice: 0, stockCount: 0
  });

  const loadProducts = async () => {
    const list = await ProductRepo.getAllActive();
    setProducts(list);
  };

  useEffect(() => { loadProducts(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name) return;
    
    await ProductRepo.create({
      name: newProduct.name,
      baseCost: newProduct.baseCost || 0,
      sellingPrice: newProduct.sellingPrice || 0,
      stockCount: newProduct.stockCount || 0,
      description: newProduct.description
    });

    setNewProduct({ name: '', baseCost: 0, sellingPrice: 0, stockCount: 0 });
    setShowForm(false);
    loadProducts();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Deseja excluir este produto?')) {
      await ProductRepo.softDelete(id);
      loadProducts();
    }
  };

  const inputClasses = "w-full rounded-2xl border-slate-200 bg-white p-3 border text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all";

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Catálogo de Produtos</h2>
          <p className="text-slate-500 text-sm">Gerencie seu estoque e preços</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
        >
          {showForm ? 'Fechar' : '+ Novo Produto'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">Nome do Produto</label>
              <input 
                type="text" 
                value={newProduct.name}
                onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                className={inputClasses}
                placeholder="Ex: Caneca Personalizada"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">Quantidade em Estoque</label>
              <input 
                type="number" 
                value={newProduct.stockCount}
                onChange={e => setNewProduct({...newProduct, stockCount: parseInt(e.target.value)})}
                className={inputClasses}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">Custo de Produção (R$)</label>
              <input 
                type="number" step="0.01"
                value={newProduct.baseCost}
                onChange={e => setNewProduct({...newProduct, baseCost: parseFloat(e.target.value)})}
                className={inputClasses + " font-mono"}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">Preço de Venda (R$)</label>
              <input 
                type="number" step="0.01"
                value={newProduct.sellingPrice}
                onChange={e => setNewProduct({...newProduct, sellingPrice: parseFloat(e.target.value)})}
                className={inputClasses + " font-mono"}
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg">
            Salvar Produto no Catálogo
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map(product => (
          <div key={product.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-800">{product.name}</h3>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Estoque</span>
              </div>
              <button 
                onClick={() => product.id && handleDelete(product.id)}
                className="text-slate-300 hover:text-rose-500 p-2 hover:bg-rose-50 rounded-xl transition-all"
              >
                🗑️
              </button>
            </div>
            
            <div className="flex items-end justify-between">
              <div className={`text-2xl font-black ${product.stockCount < 5 ? 'text-rose-500' : 'text-slate-900'}`}>
                {product.stockCount} <span className="text-xs font-medium text-slate-400">unid.</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">Preço</span>
                <span className="text-xl font-black text-indigo-600">R$ {product.sellingPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}
        {products.length === 0 && !showForm && (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300">
            <span className="text-6xl mb-4 block">📦</span>
            <p className="text-slate-400 font-medium">Nenhum produto cadastrado ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
};

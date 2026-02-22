
import React, { useState, useEffect } from 'react';
import { Category, TransactionType } from '../types';
import { CategoryRepo } from '../repositories';

const COLOR_PRESETS = [
  '#4F46E5', // Indigo
  '#10B981', // Emerald
  '#F43F5E', // Rose
  '#F59E0B', // Amber
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#EC4899', // Pink
];

export const Categories: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  const [formData, setFormData] = useState<Partial<Category>>({
    name: '',
    type: TransactionType.EXPENSE,
    color: COLOR_PRESETS[0]
  });

  const loadData = async () => {
    const list = await CategoryRepo.getAllActive();
    setCategories(list);
  };

  useEffect(() => { loadData(); }, []);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormData({ name: '', type: TransactionType.EXPENSE, color: COLOR_PRESETS[0] });
    setShowForm(true);
  };

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({ 
      name: category.name, 
      type: category.type, 
      color: category.color || COLOR_PRESETS[0] 
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    
    setLoading(true);
    try {
      if (editingCategory?.id) {
        await CategoryRepo.update(editingCategory.id, {
          name: formData.name,
          type: formData.type || TransactionType.EXPENSE,
          color: formData.color || COLOR_PRESETS[0]
        });
      } else {
        await CategoryRepo.create({
          name: formData.name,
          type: formData.type || TransactionType.EXPENSE,
          color: formData.color || COLOR_PRESETS[0]
        });
      }
      setFormData({ name: '', type: TransactionType.EXPENSE, color: COLOR_PRESETS[0] });
      setShowForm(false);
      setEditingCategory(null);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Deseja excluir esta categoria? Transações existentes manterão seus dados, mas a categoria não poderá mais ser selecionada.')) {
      await CategoryRepo.softDelete(id);
      loadData();
    }
  };

  const inputClasses = "w-full rounded-2xl border-slate-200 bg-white p-3.5 border text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-sm";

  return (
    <div className="space-y-6 animate-fadeIn pb-32 md:pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Tags & Categorias</h2>
          <p className="text-slate-500 text-sm font-medium">Organize seu fluxo financeiro</p>
        </div>
        <button 
          onClick={showForm ? () => setShowForm(false) : handleOpenAdd}
          className={`w-full md:w-auto px-6 py-3.5 rounded-2xl font-black transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2 ${
            showForm ? 'bg-slate-200 text-slate-700 shadow-none' : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'
          }`}
        >
          {showForm ? '✕ Cancelar' : '＋ Nova Categoria'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-2xl space-y-6 max-w-2xl mx-auto animate-slideDown">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-50 text-xl">
              {editingCategory ? '✏️' : '✨'}
            </div>
            <h3 className="text-lg font-black text-slate-900">
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className={inputClasses}
                  placeholder="Ex: Matéria-prima"
                  required
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Fluxo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: TransactionType.INCOME})}
                    className={`py-3 rounded-2xl font-bold transition-all border text-xs ${
                      formData.type === TransactionType.INCOME 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700' 
                        : 'bg-white border-slate-200 text-slate-400 opacity-60'
                    }`}
                  >
                    📥 Receita
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: TransactionType.EXPENSE})}
                    className={`py-3 rounded-2xl font-bold transition-all border text-xs ${
                      formData.type === TransactionType.EXPENSE 
                        ? 'bg-rose-50 border-rose-500 text-rose-700' 
                        : 'bg-white border-slate-200 text-slate-400 opacity-60'
                    }`}
                  >
                    📤 Despesa
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Cor de Identificação</label>
              <div className="grid grid-cols-4 gap-3 bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                {COLOR_PRESETS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({...formData, color})}
                    className={`aspect-square rounded-2xl border-4 transition-all flex items-center justify-center active:scale-90 ${
                      formData.color === color ? 'border-slate-800 scale-105 shadow-md' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {formData.color === color && <span className="text-white text-lg">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-slate-950 text-white py-4.5 rounded-2xl font-black hover:bg-slate-800 transition-all active:scale-[0.98] shadow-xl text-lg mt-2"
          >
            {loading ? 'Processando...' : (editingCategory ? 'Salvar Alterações' : 'Confirmar Categoria')}
          </button>
        </form>
      )}

      {/* Grid de Cards Otimizado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(category => (
          <div 
            key={category.id} 
            className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden group hover:shadow-lg transition-all duration-300 relative"
          >
            {/* Faixa Superior com a Cor */}
            <div 
              className="h-1.5 w-full shrink-0"
              style={{ backgroundColor: category.color }}
            ></div>

            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div 
                    className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-xl shadow-sm border border-white"
                    style={{ backgroundColor: `${category.color}15`, color: category.color }}
                  >
                    {category.type === TransactionType.INCOME ? '💰' : '🏷️'}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-slate-900 leading-tight truncate text-base md:text-lg" title={category.name}>
                      {category.name}
                    </h4>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full inline-block mt-1.5 border whitespace-nowrap ${
                      category.type === TransactionType.INCOME 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                        : 'bg-rose-50 text-rose-600 border-rose-100'
                    }`}>
                      {category.type === TransactionType.INCOME ? 'Receita' : 'Despesa'}
                    </span>
                  </div>
                </div>
                
                {/* Ações Mobile-Friendly */}
                <div className="flex flex-shrink-0 gap-1.5">
                  <button 
                    onClick={() => handleOpenEdit(category)}
                    className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-90"
                    title="Editar"
                  >
                    ✏️
                  </button>
                  <button 
                    onClick={() => category.id && handleDelete(category.id)}
                    className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all active:scale-90"
                    title="Excluir"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {categories.length === 0 && !showForm && (
          <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border border-dashed border-slate-200">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl opacity-50">📂</span>
            </div>
            <h3 className="text-xl font-black text-slate-800">Sem categorias</h3>
            <p className="text-slate-400 font-medium max-w-xs mx-auto mt-2 px-6">
              Organize suas movimentações para entender melhor sua lucratividade.
            </p>
            <button 
              onClick={handleOpenAdd}
              className="mt-6 bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
            >
              Criar Primeira Categoria
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

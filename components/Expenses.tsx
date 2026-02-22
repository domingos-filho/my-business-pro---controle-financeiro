
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, Category } from '../types';
import { TransactionRepo, CategoryRepo } from '../repositories';
import { TransactionService } from '../services/TransactionService';

export const Expenses: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({ 
    amount: 0, 
    description: '', 
    date: new Date().toISOString().split('T')[0],
    type: TransactionType.EXPENSE,
    categoryId: 0
  });

  const loadData = async () => {
    const [txList, catList] = await Promise.all([
      TransactionRepo.getAllActive(),
      CategoryRepo.getAllActive()
    ]);
    
    // Filtramos apenas transações manuais (sem orderId) para este módulo
    // ou todas as transações se preferir ver tudo aqui. 
    // Por clareza, mostraremos todas as transações financeiras.
    setTransactions(txList.sort((a,b) => b.date - a.date));
    setCategories(catList);
  };

  useEffect(() => { loadData(); }, []);

  const filteredCategories = useMemo(() => {
    return categories.filter(c => c.type === formData.type);
  }, [categories, formData.type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || formData.amount <= 0 || formData.categoryId === 0) {
      alert("Por favor, preencha todos os campos e selecione uma categoria.");
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        amount: formData.amount,
        description: formData.description,
        categoryId: formData.categoryId,
        date: new Date(formData.date).getTime()
      };

      if (formData.type === TransactionType.INCOME) {
        await TransactionService.createIncome(payload);
      } else {
        await TransactionService.createExpense(payload);
      }

      setFormData({ 
        amount: 0, 
        description: '', 
        date: new Date().toISOString().split('T')[0],
        type: TransactionType.EXPENSE,
        categoryId: 0
      });
      setShowForm(false);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Deseja excluir esta movimentação?')) {
      await TransactionService.deleteTransaction(id);
      loadData();
    }
  };

  const inputClasses = "w-full rounded-2xl border-slate-200 bg-white p-3 border text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all";

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Movimentações Financeiras</h2>
          <p className="text-slate-500 text-sm">Registre entradas e saídas manuais do seu caixa</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className={`${showForm ? 'bg-slate-200 text-slate-700' : 'bg-slate-900 text-white shadow-slate-200'} px-5 py-2.5 rounded-2xl font-bold shadow-lg transition-all active:scale-95`}
        >
          {showForm ? 'Fechar' : '+ Nova Movimentação'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-5 max-w-2xl mx-auto ring-1 ring-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-2">Tipo de Movimentação</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, type: TransactionType.INCOME, categoryId: 0})}
                  className={`py-3 rounded-2xl font-bold transition-all border ${
                    formData.type === TransactionType.INCOME 
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20' 
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  📥 Entrada (Receita)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, type: TransactionType.EXPENSE, categoryId: 0})}
                  className={`py-3 rounded-2xl font-bold transition-all border ${
                    formData.type === TransactionType.EXPENSE 
                      ? 'bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-500/20' 
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  📤 Saída (Despesa)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">Categoria</label>
              <select 
                value={formData.categoryId}
                onChange={e => setFormData({...formData, categoryId: parseInt(e.target.value)})}
                className={inputClasses}
                required
              >
                <option value="0">Selecione uma categoria</option>
                {filteredCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              {filteredCategories.length === 0 && (
                <p className="text-[10px] text-amber-600 mt-1 font-bold">⚠️ Nenhuma categoria de {formData.type === TransactionType.INCOME ? 'Receita' : 'Despesa'} encontrada.</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">Data</label>
              <input 
                type="date" 
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className={inputClasses}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">Descrição / Motivo</label>
              <input 
                type="text" 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className={inputClasses}
                placeholder="Ex: Pagamento de Aluguel, Venda Avulsa..."
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">Valor (R$)</label>
              <input 
                type="number" step="0.01"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})}
                className={inputClasses + " text-2xl font-black py-4"}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className={`w-full py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-xl disabled:opacity-50 ${
              formData.type === TransactionType.INCOME ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-slate-800'
            } text-white`}
          >
            {loading ? 'Processando...' : `Confirmar ${formData.type === TransactionType.INCOME ? 'Receita' : 'Gasto'}`}
          </button>
        </form>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
           <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">Histórico de Movimentações</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {transactions.map(tx => {
            const category = categories.find(c => c.id === tx.categoryId);
            const isIncome = tx.type === TransactionType.INCOME;
            
            return (
              <div key={tx.id} className="p-5 flex items-center justify-between group hover:bg-slate-50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm border border-white"
                    style={{ 
                      backgroundColor: category?.color ? `${category.color}15` : (isIncome ? '#ecfdf5' : '#fff1f2'),
                      color: category?.color || (isIncome ? '#10b981' : '#f43f5e')
                    }}
                  >
                    {isIncome ? '💰' : '💸'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-800">{tx.description}</h4>
                      {tx.orderId && (
                        <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md font-black uppercase">Pedido</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium">
                      <span>{new Date(tx.date).toLocaleDateString('pt-BR')}</span>
                      <span>•</span>
                      <span className="font-bold uppercase tracking-tighter" style={{ color: category?.color }}>
                        {category?.name || 'Sem Categoria'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-6">
                  <span className={`font-black text-lg ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isIncome ? '+' : '-'} R$ {tx.amount.toFixed(2)}
                  </span>
                  {!tx.orderId && (
                    <button 
                      onClick={() => tx.id && handleDelete(tx.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-rose-50 rounded-xl text-slate-300 hover:text-rose-500"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {transactions.length === 0 && !showForm && (
          <div className="py-20 text-center">
            <span className="text-5xl mb-4 block">📈</span>
            <p className="text-slate-400 font-medium">Nenhuma movimentação registrada no histórico.</p>
          </div>
        )}
      </div>
    </div>
  );
};

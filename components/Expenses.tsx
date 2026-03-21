import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangleIcon,
  ChartUpIcon,
  ExpenseIcon,
  IncomeIcon,
  TrashIcon,
} from './AppIcons';
import { CategoryRepo, TransactionRepo } from '../repositories';
import { TransactionService } from '../services/TransactionService';
import { Category, Transaction, TransactionType } from '../types';

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
    categoryId: 0,
  });

  const loadData = async () => {
    const [transactionList, categoryList] = await Promise.all([
      TransactionRepo.getAllActive(),
      CategoryRepo.getAllActive(),
    ]);

    setTransactions(transactionList.sort((left, right) => right.date - left.date));
    setCategories(categoryList);
  };

  useEffect(() => {
    loadData();
  }, []);

  const parseIntegerOrZero = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const parseFloatOrZero = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === formData.type),
    [categories, formData.type],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.description || formData.amount <= 0 || formData.categoryId === 0) {
      alert('Por favor, preencha todos os campos e selecione uma categoria.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        amount: formData.amount,
        description: formData.description,
        categoryId: formData.categoryId,
        date: new Date(formData.date).getTime(),
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
        categoryId: 0,
      });
      setShowForm(false);
      loadData();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Deseja excluir esta movimentacao?')) {
      await TransactionService.deleteTransaction(id);
      loadData();
    }
  };

  const inputClasses =
    'w-full rounded-2xl border-slate-200 bg-white p-3 border text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all';

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Movimentacoes Financeiras</h2>
          <p className="text-slate-500 text-sm">Registre entradas e saidas manuais do seu caixa</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`${showForm ? 'bg-slate-200 text-slate-700' : 'bg-slate-900 text-white shadow-slate-200'} px-5 py-2.5 rounded-2xl font-bold shadow-lg transition-all active:scale-95`}
        >
          {showForm ? 'Fechar' : '+ Nova Movimentacao'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-5 max-w-2xl mx-auto ring-1 ring-slate-100"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-2">
                Tipo de Movimentacao
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, type: TransactionType.INCOME, categoryId: 0 })
                  }
                  className={`py-3 rounded-2xl font-bold transition-all border inline-flex items-center justify-center gap-2 ${
                    formData.type === TransactionType.INCOME
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  <IncomeIcon className="w-4 h-4" />
                  <span>Entrada (Receita)</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, type: TransactionType.EXPENSE, categoryId: 0 })
                  }
                  className={`py-3 rounded-2xl font-bold transition-all border inline-flex items-center justify-center gap-2 ${
                    formData.type === TransactionType.EXPENSE
                      ? 'bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-500/20'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  <ExpenseIcon className="w-4 h-4" />
                  <span>Saida (Despesa)</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">
                Categoria
              </label>
              <select
                value={formData.categoryId}
                onChange={(event) =>
                  setFormData({ ...formData, categoryId: parseIntegerOrZero(event.target.value) })
                }
                className={inputClasses}
                required
              >
                <option value="0">Selecione uma categoria</option>
                {filteredCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {filteredCategories.length === 0 && (
                <p className="text-[10px] text-amber-600 mt-1 font-bold inline-flex items-center gap-1">
                  <AlertTriangleIcon className="w-3.5 h-3.5" />
                  <span>
                    Nenhuma categoria de{' '}
                    {formData.type === TransactionType.INCOME ? 'Receita' : 'Despesa'} encontrada.
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">
                Data
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(event) => setFormData({ ...formData, date: event.target.value })}
                className={inputClasses}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">
                Descricao / Motivo
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(event) =>
                  setFormData({ ...formData, description: event.target.value })
                }
                className={inputClasses}
                placeholder="Ex: Pagamento de aluguel, venda avulsa..."
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">
                Valor (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(event) =>
                  setFormData({ ...formData, amount: parseFloatOrZero(event.target.value) })
                }
                className={`${inputClasses} text-2xl font-black py-4`}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-xl disabled:opacity-50 ${
              formData.type === TransactionType.INCOME
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-slate-900 hover:bg-slate-800'
            } text-white`}
          >
            {loading
              ? 'Processando...'
              : `Confirmar ${formData.type === TransactionType.INCOME ? 'Receita' : 'Gasto'}`}
          </button>
        </form>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">
            Historico de Movimentacoes
          </h3>
        </div>
        <div className="divide-y divide-slate-100">
          {transactions.map((transaction) => {
            const category = categories.find((item) => item.id === transaction.categoryId);
            const isIncome = transaction.type === TransactionType.INCOME;

            return (
              <div
                key={transaction.id}
                className="p-5 flex items-center justify-between group hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border border-white"
                    style={{
                      backgroundColor: category?.color
                        ? `${category.color}15`
                        : isIncome
                          ? '#ecfdf5'
                          : '#fff1f2',
                      color: category?.color || (isIncome ? '#10b981' : '#f43f5e'),
                    }}
                  >
                    {isIncome ? (
                      <IncomeIcon className="w-5 h-5" />
                    ) : (
                      <ExpenseIcon className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-800">{transaction.description}</h4>
                      {transaction.orderId && (
                        <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md font-black uppercase">
                          Pedido
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium">
                      <span>{new Date(transaction.date).toLocaleDateString('pt-BR')}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                      <span
                        className="font-bold uppercase tracking-tighter"
                        style={{ color: category?.color }}
                      >
                        {category?.name || 'Sem Categoria'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-6">
                  <span className={`font-black text-lg ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isIncome ? '+' : '-'} R$ {transaction.amount.toFixed(2)}
                  </span>
                  {!transaction.orderId && (
                    <button
                      onClick={() => transaction.id && handleDelete(transaction.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-rose-50 rounded-xl text-slate-300 hover:text-rose-500"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {transactions.length === 0 && !showForm && (
          <div className="py-20 text-center">
            <ChartUpIcon className="w-14 h-14 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-400 font-medium">
              Nenhuma movimentacao registrada no historico.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

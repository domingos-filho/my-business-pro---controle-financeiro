import React, { useEffect, useMemo, useState } from 'react';
import { EditIcon, PhoneIcon, TrashIcon, UsersIcon, XIcon } from './AppIcons';
import { CustomerRepo, OrderRepo } from '../repositories';
import { Customer, SaleStatus } from '../types';
import { isValidEmail, normalizeEmail, normalizePhone, normalizeText } from '../utils/input';

interface CustomerFormState {
  name: string;
  email: string;
  phone: string;
}

interface CustomerCard extends Customer {
  totalPurchasedAmount: number;
  totalPaidOrders: number;
}

const emptyForm = (): CustomerFormState => ({
  name: '',
  email: '',
  phone: '',
});

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);

export const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerCard[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerCard | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState<CustomerFormState>(emptyForm);

  const loadData = async () => {
    const [customerList, orderList] = await Promise.all([
      CustomerRepo.getAllActive(),
      OrderRepo.getAllActive(),
    ]);

    const totalByCustomer = orderList.reduce((acc, order) => {
      if (order.status !== SaleStatus.PAID) {
        return acc;
      }

      const customerId = Number(order.customerId || 0);
      if (!customerId) return acc;

      const current = acc.get(customerId) || { totalPurchasedAmount: 0, totalPaidOrders: 0 };
      current.totalPurchasedAmount += Number(order.totalAmount || 0);
      current.totalPaidOrders += 1;
      acc.set(customerId, current);
      return acc;
    }, new Map<number, { totalPurchasedAmount: number; totalPaidOrders: number }>());

    const normalized = customerList
      .map((customer) => {
        const stats = totalByCustomer.get(Number(customer.id || 0));
        return {
          ...customer,
          totalPurchasedAmount: stats?.totalPurchasedAmount || 0,
          totalPaidOrders: stats?.totalPaidOrders || 0,
        };
      })
      .sort((left, right) => right.updatedAt - left.updatedAt);

    setCustomers(normalized);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm, 80).toLowerCase();
    if (!normalizedSearch) return customers;

    return customers.filter((customer) => {
      const name = String(customer.name || '').toLowerCase();
      const email = String(customer.email || '').toLowerCase();
      const phone = String(customer.phone || '').toLowerCase();
      return (
        name.includes(normalizedSearch) ||
        email.includes(normalizedSearch) ||
        phone.includes(normalizedSearch)
      );
    });
  }, [customers, searchTerm]);

  const openCreateForm = () => {
    setEditingCustomer(null);
    setErrorMessage('');
    setFormData(emptyForm());
    setShowForm(true);
  };

  const openEditForm = (customer: CustomerCard) => {
    setEditingCustomer(customer);
    setErrorMessage('');
    setFormData({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCustomer(null);
    setErrorMessage('');
    setFormData(emptyForm());
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      name: normalizeText(formData.name, 120),
      email: normalizeEmail(formData.email),
      phone: normalizePhone(formData.phone),
    };

    if (payload.name.length < 2) {
      setErrorMessage('Informe um nome com pelo menos 2 caracteres.');
      return;
    }

    if (payload.email && !isValidEmail(payload.email)) {
      setErrorMessage('Informe um e-mail válido.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      if (editingCustomer?.id) {
        await CustomerRepo.update(editingCustomer.id, payload);
      } else {
        await CustomerRepo.create(payload);
      }

      closeForm();
      await loadData();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível salvar o cliente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (customer: CustomerCard) => {
    if (!customer.id) return;

    const accepted = window.confirm(
      `Deseja excluir o cliente "${customer.name}"?`,
    );

    if (!accepted) return;

    setLoading(true);
    try {
      await CustomerRepo.softDelete(customer.id);
      await loadData();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível excluir o cliente.');
    } finally {
      setLoading(false);
    }
  };

  const inputClasses =
    'w-full rounded-2xl border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 p-3 border text-slate-900 font-medium outline-none transition-all';

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Clientes</h2>
          <p className="text-slate-500 text-sm font-medium">Base de contatos para suas vendas</p>
        </div>
        <div className="flex w-full gap-3 md:w-auto">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone"
            className={`${inputClasses} md:w-[320px]`}
          />
          <button
            onClick={showForm ? closeForm : openCreateForm}
            className="inline-flex min-w-[170px] items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95"
          >
            {showForm ? (
              <>
                <XIcon className="h-4 w-4" />
                <span>Fechar</span>
              </>
            ) : (
              <span>+ Novo cliente</span>
            )}
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-4 max-w-lg"
        >
          <h3 className="text-lg font-black text-slate-900">
            {editingCustomer ? 'Editar cliente' : 'Novo cliente'}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">
                Nome completo
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                onBlur={(event) =>
                  setFormData((current) => ({
                    ...current,
                    name: normalizeText(event.target.value, 120),
                  }))
                }
                className={inputClasses}
                placeholder="Ex: Maria Silva"
                autoComplete="name"
                maxLength={120}
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">
                  WhatsApp/telefone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(event) =>
                    setFormData({ ...formData, phone: normalizePhone(event.target.value) })
                  }
                  className={inputClasses}
                  placeholder="(00) 00000-0000"
                  autoComplete="tel"
                  maxLength={20}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData({ ...formData, email: event.target.value })
                  }
                  onBlur={(event) =>
                    setFormData((current) => ({
                      ...current,
                      email: normalizeEmail(event.target.value),
                    }))
                  }
                  className={inputClasses}
                  placeholder="cliente@email.com"
                  autoComplete="email"
                  maxLength={160}
                />
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg disabled:opacity-60"
          >
            {loading ? 'Salvando...' : editingCustomer ? 'Salvar alterações' : 'Salvar cliente'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((customer) => (
          <div
            key={customer.id}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow space-y-4"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-xl font-bold">
                {customer.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-slate-800 font-bold truncate">{customer.name}</h3>
                <p className="text-slate-400 text-xs truncate">{customer.phone || 'Sem telefone'}</p>
                <p className="text-slate-400 text-xs truncate">{customer.email || 'Sem e-mail'}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Total de produtos adquiridos
              </p>
              <p className="mt-1 text-lg font-black text-slate-900">
                {formatCurrency(customer.totalPurchasedAmount)}
              </p>
              <p className="text-xs text-slate-500">
                {customer.totalPaidOrders} pedido(s) pago(s)
              </p>
            </div>

            <div className="flex space-x-2 justify-end">
              {customer.phone && (
                <a
                  href={`https://wa.me/${customer.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                  title="Abrir WhatsApp"
                >
                  <PhoneIcon className="w-4 h-4" />
                </a>
              )}
              <button
                type="button"
                onClick={() => openEditForm(customer)}
                className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                title="Editar cliente"
              >
                <EditIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(customer)}
                className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-colors"
                title="Excluir cliente"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {filteredCustomers.length === 0 && !showForm && (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300">
            <UsersIcon className="w-14 h-14 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-400 font-medium">Nenhum cliente encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { PhoneIcon, UsersIcon } from './AppIcons';
import { CustomerRepo } from '../repositories';
import { Customer } from '../types';

export const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    email: '',
    phone: '',
  });

  const loadData = async () => {
    const list = await CustomerRepo.getAllActive();
    setCustomers(list);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.name) return;

    await CustomerRepo.create({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
    });

    setFormData({ name: '', email: '', phone: '' });
    setShowForm(false);
    loadData();
  };

  const inputClasses =
    'w-full rounded-2xl border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 p-3 border text-slate-900 font-medium outline-none transition-all';

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Clientes</h2>
          <p className="text-slate-500 text-sm">Base de contatos para suas vendas</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
        >
          {showForm ? 'Fechar' : '+ Novo Cliente'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-4 max-w-lg"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                className={inputClasses}
                placeholder="Ex: Maria Silva"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">
                  WhatsApp/Telefone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                  className={inputClasses}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase ml-1 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                  className={inputClasses}
                  placeholder="cliente@email.com"
                />
              </div>
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg"
          >
            Salvar Cliente
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((customer) => (
          <div
            key={customer.id}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-4 hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-xl font-bold">
              {customer.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-slate-800 font-bold truncate">{customer.name}</h3>
              <p className="text-slate-400 text-xs truncate">{customer.phone || 'Sem telefone'}</p>
            </div>
            <div className="flex space-x-2">
              {customer.phone && (
                <a
                  href={`https://wa.me/${customer.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                >
                  <PhoneIcon className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        ))}
        {customers.length === 0 && !showForm && (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300">
            <UsersIcon className="w-14 h-14 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-400 font-medium">Nenhum cliente encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
};

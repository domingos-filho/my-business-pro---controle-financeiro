
import React, { useState, useEffect, useMemo } from 'react';
import { Order, Product, Customer, SaleStatus } from '../types';
import { OrderRepo, ProductRepo, CustomerRepo } from '../repositories';
import { OrderService } from '../services/OrderService';

type SortField = 'date' | 'totalAmount';
type SortDirection = 'asc' | 'desc';

export const Sales: React.FC = () => {
  const [orders, setOrders] = useState<(Order & { customerName?: string, productName?: string })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [sortConfig, setSortConfig] = useState<{field: SortField, direction: SortDirection}>({
    field: 'date',
    direction: 'desc'
  });

  const [formData, setFormData] = useState({ customerId: 0, productId: 0, quantity: 1 });

  const loadData = async () => {
    const [ord, prod, cust] = await Promise.all([
      OrderRepo.getAllActive(),
      ProductRepo.getAllActive(),
      CustomerRepo.getAllActive()
    ]);

    const enrichedOrders = ord.map(o => ({
      ...o,
      customerName: cust.find(c => c.id === o.customerId)?.name || 'Cliente Removido',
      productName: prod.find(p => p.id === o.productId)?.name || 'Produto Removido'
    }));

    setOrders(enrichedOrders);
    setProducts(prod);
    setCustomers(cust);
  };

  useEffect(() => { loadData(); }, []);

  const filteredAndSortedOrders = useMemo(() => {
    let result = [...orders];
    if (filterStatus !== 'ALL') {
      result = result.filter(o => o.status === filterStatus);
    }
    result.sort((a, b) => {
      let valA = a[sortConfig.field] || 0;
      let valB = b[sortConfig.field] || 0;
      return sortConfig.direction === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
    return result;
  }, [orders, filterStatus, sortConfig]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.customerId === 0 || formData.productId === 0) return;
    
    setLoading(true);
    try {
      await OrderService.createOrder(formData.customerId, formData.productId, formData.quantity);
      setShowForm(false);
      setFormData({ customerId: 0, productId: 0, quantity: 1 });
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async (id: number) => {
    if (confirm('Confirmar recebimento deste pedido? Isso registrará a entrada no seu caixa.')) {
      setLoading(true);
      try {
        await OrderService.markAsPaid(id);
        await loadData();
      } catch (err: any) {
        console.error("Erro ao confirmar pagamento:", err);
        alert("Não foi possível confirmar o pagamento. " + (err.message || "Tente novamente."));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCancel = async (id: number) => {
    if (confirm('Deseja realmente cancelar este pedido? O estoque será devolvido.')) {
      setLoading(true);
      try {
        await OrderService.cancelOrder(id);
        await loadData();
      } catch (err: any) {
        alert("Erro ao cancelar: " + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const inputClasses = "w-full rounded-2xl border-slate-200 bg-white p-3 border text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm appearance-none";
  const formInputClasses = "w-full rounded-2xl border-slate-200 bg-white p-3.5 border text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-sm";

  const StatusBadge = ({ status }: { status: SaleStatus }) => {
    const styles = {
      [SaleStatus.PAID]: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      [SaleStatus.PENDING]: 'bg-amber-50 text-amber-600 border-amber-100',
      [SaleStatus.CANCELLED]: 'bg-slate-50 text-slate-500 border-slate-100'
    };
    const labels = {
      [SaleStatus.PAID]: 'Pago',
      [SaleStatus.PENDING]: 'Pendente',
      [SaleStatus.CANCELLED]: 'Cancelado'
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Vendas</h2>
          <p className="text-slate-500 text-sm font-medium">Gerencie suas ordens e fluxo de caixa</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          disabled={loading}
          className="w-full md:w-auto bg-indigo-600 text-white px-6 py-3.5 rounded-2xl font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {showForm ? '✕ Fechar Form' : '＋ Nova Venda'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateOrder} className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-2xl space-y-5 max-w-3xl mx-auto animate-slideDown">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Cliente</label>
              <select 
                value={formData.customerId}
                onChange={e => setFormData({...formData, customerId: parseInt(e.target.value)})}
                className={formInputClasses}
                required
              >
                <option value="0">Selecione um cliente</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Produto</label>
              <select 
                value={formData.productId}
                onChange={e => setFormData({...formData, productId: parseInt(e.target.value)})}
                className={formInputClasses}
                required
              >
                <option value="0">Selecione um produto</option>
                {products.map(p => (
                  <option key={p.id} value={p.id} disabled={p.stockCount <= 0}>
                    {p.name} (R$ {p.sellingPrice.toFixed(2)}) - {p.stockCount} em estoque
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantidade</label>
              <input 
                type="number" 
                min="1"
                value={formData.quantity}
                onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})}
                className={formInputClasses}
                required
              />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-slate-950 text-white py-4.5 rounded-2xl font-black hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-[0.98] shadow-xl text-lg mt-4"
          >
            {loading ? 'Processando Pedido...' : 'Confirmar Pedido'}
          </button>
        </form>
      )}

      {/* Toolbar / Filtros */}
      <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-5 items-center">
        <div className="w-full md:w-auto flex-1 grid grid-cols-2 md:flex md:flex-row gap-4">
          <div className="relative">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest absolute -top-2 left-3 bg-white px-1 z-10">Status</label>
            <select 
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className={inputClasses}
            >
              <option value="ALL">Todos</option>
              <option value={SaleStatus.PENDING}>Pendentes</option>
              <option value={SaleStatus.PAID}>Pagos</option>
              <option value={SaleStatus.CANCELLED}>Cancelados</option>
            </select>
          </div>
          <div className="relative">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest absolute -top-2 left-3 bg-white px-1 z-10">Ordem</label>
            <select 
              value={`${sortConfig.field}-${sortConfig.direction}`}
              onChange={e => {
                const [field, direction] = e.target.value.split('-');
                setSortConfig({ field: field as SortField, direction: direction as SortDirection });
              }}
              className={inputClasses}
            >
              <option value="date-desc">Recentes</option>
              <option value="date-asc">Antigos</option>
              <option value="totalAmount-desc">Valor (+)</option>
              <option value="totalAmount-asc">Valor (-)</option>
            </select>
          </div>
        </div>
        <div className="hidden md:block">
          <p className="text-xs font-bold text-slate-400 whitespace-nowrap">
            <span className="text-slate-900 font-black">{filteredAndSortedOrders.length}</span> resultados
          </p>
        </div>
      </div>

      {/* Mobile view (Cards) */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredAndSortedOrders.map(order => (
          <div key={order.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(order.date).toLocaleDateString('pt-BR')}</p>
                <h4 className="text-lg font-black text-slate-900 leading-tight mt-1">{order.customerName}</h4>
                <p className="text-sm font-medium text-slate-500">{order.quantity}x {order.productName}</p>
              </div>
              <StatusBadge status={order.status as SaleStatus} />
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
              <div className="text-xl font-black text-slate-950">
                R$ {order.totalAmount.toFixed(2)}
              </div>
              
              <div className="flex gap-2">
                {order.status === SaleStatus.PENDING && (
                  <>
                    <button 
                      onClick={() => order.id && handleConfirmPayment(order.id)} 
                      disabled={loading}
                      className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-lg active:scale-90 transition-transform shadow-sm disabled:opacity-50"
                    >
                      {loading ? '⌛' : '✅'}
                    </button>
                    <button 
                      onClick={() => order.id && handleCancel(order.id)} 
                      disabled={loading}
                      className="w-10 h-10 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center text-lg active:scale-90 transition-transform shadow-sm disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop View (Table) */}
      <div className="hidden md:block bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Data</th>
              <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Detalhes do Pedido</th>
              <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
              <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
              <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredAndSortedOrders.map(order => (
              <tr key={order.id} className="hover:bg-slate-50/30 transition-colors group">
                <td className="px-8 py-5 text-sm font-bold text-slate-400 whitespace-nowrap">
                  {new Date(order.date).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-8 py-5">
                  <div className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{order.customerName}</div>
                  <div className="text-xs font-bold text-slate-400 mt-0.5">{order.quantity}x {order.productName}</div>
                </td>
                <td className="px-8 py-5 text-center">
                  <StatusBadge status={order.status as SaleStatus} />
                </td>
                <td className="px-8 py-5 text-right font-black text-slate-950 text-lg">
                  R$ {order.totalAmount.toFixed(2)}
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {order.status === SaleStatus.PENDING && (
                      <>
                        <button 
                          onClick={() => order.id && handleConfirmPayment(order.id)} 
                          disabled={loading}
                          className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-100 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {loading ? 'Processando' : 'Pago'}
                        </button>
                        <button 
                          onClick={() => order.id && handleCancel(order.id)} 
                          disabled={loading}
                          className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAndSortedOrders.length === 0 && (
        <div className="py-24 text-center bg-white rounded-[2rem] border border-dashed border-slate-200">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl opacity-50">🔎</span>
          </div>
          <h3 className="text-xl font-black text-slate-900">Nenhum pedido</h3>
          <p className="text-slate-400 font-medium max-w-xs mx-auto mt-2">Não encontramos vendas para os filtros aplicados.</p>
        </div>
      )}
    </div>
  );
};

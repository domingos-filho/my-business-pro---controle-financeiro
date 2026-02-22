
import React, { useEffect, useState } from 'react';
import { CashFlowSummary, CashFlowService } from '../services/CashFlowService';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<CashFlowSummary | null>(null);

  const loadData = async () => {
    const data = await CashFlowService.getSummary();
    setSummary(data);
  };

  useEffect(() => { loadData(); }, []);

  if (!summary) return <div className="h-screen flex items-center justify-center font-bold text-slate-400 animate-pulse">Carregando...</div>;

  const chartData = [
    { name: 'Receita', value: summary.monthlyIncome, color: '#0f172a' },
    { name: 'Gasto', value: summary.monthlyExpenses, color: '#94a3b8' },
    { name: 'Lucro', value: summary.monthlyProfit, color: '#4f46e5' }
  ];

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-10 pb-10 animate-fadeIn">
      <header>
        <h1 className="text-4xl font-black text-slate-950 tracking-tighter leading-none mb-1">Seu Negócio.</h1>
        <p className="text-slate-400 font-medium">Panorama financeiro de {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date())}</p>
      </header>

      {/* Hero Stats */}
      <section className="bg-slate-950 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-100 relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-2 block">Saldo em Conta</span>
          <h2 className="text-5xl font-black tracking-tight mb-8">
            {formatCurrency(summary.currentBalance)}
          </h2>
          <div className="flex gap-8">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Receita Mensal</span>
              <span className="text-lg font-bold text-emerald-400">+{formatCurrency(summary.monthlyIncome)}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Gastos Mensal</span>
              <span className="text-lg font-bold text-rose-400">-{formatCurrency(summary.monthlyExpenses)}</span>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none text-9xl">💰</div>
      </section>

      {/* Grid de Métricas Secundárias (Ajustado para 2/3 e 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance - Ocupando 2 colunas */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between h-72">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-slate-400 uppercase text-xs tracking-widest">Performance Mensal</h3>
            <span className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Gráfico de Fluxo</span>
          </div>
          <div className="flex-1 mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#94a3b8'}} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', fontWeight: 'bold', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[12, 12, 12, 12]} barSize={50}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Insights IA - Ocupando 1 coluna */}
        <div className="lg:col-span-1 bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 rounded-[2.5rem] text-white flex flex-col justify-between h-72 shadow-xl shadow-indigo-100">
           <div className="flex justify-between items-start">
              <h3 className="font-bold uppercase text-xs tracking-widest opacity-70">Insights IA</h3>
              <span className="bg-white/20 px-2 py-1 rounded-lg text-[10px] font-black">ADVISOR</span>
           </div>
           <div>
              <p className="text-xl font-black leading-tight tracking-tight">
                {summary.monthlyIncome > 0 
                  ? `Sua margem está em ${((summary.monthlyProfit / summary.monthlyIncome) * 100).toFixed(0)}%. Mantenha o ritmo!` 
                  : 'Inicie suas vendas para ver a análise.'}
              </p>
              <button className="mt-4 text-xs font-bold border-b border-white/50 pb-1 hover:border-white transition-colors">Ver Mentor Inteligente →</button>
           </div>
        </div>
      </div>
    </div>
  );
};

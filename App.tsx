
import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { Products } from './components/Products';
import { Customers } from './components/Customers';
import { Sales } from './components/Sales';
import { Expenses } from './components/Expenses';
import { Categories } from './components/Categories';
import { Advisor } from './components/Advisor';
import { Auth } from './components/Auth';
import { SyncService, SyncStats } from './services/SyncService';
import { AuthService, User } from './services/AuthService';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(AuthService.getCurrentUser());
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setView] = useState('dashboard');
  const [syncStats, setSyncStats] = useState<SyncStats>({ pendingCount: 0 });
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const updateStats = async () => {
    const stats = await SyncService.getSyncStats();
    setSyncStats(stats);
  };

  useEffect(() => {
    let active = true;

    const restore = async () => {
      const restoredUser = await AuthService.restoreSession();
      if (!active) return;
      setUser(restoredUser);
      setAuthLoading(false);
    };

    restore();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handler = (_event: Event) => {
      setUser(null);
      setView('dashboard');
      setAuthLoading(false);
    };

    window.addEventListener('auth:unauthorized', handler);
    return () => {
      window.removeEventListener('auth:unauthorized', handler);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setShowUpdateToast(true);
      });
    }

    updateStats();
    const interval = setInterval(updateStats, 5000);
    return () => clearInterval(interval);
  }, [currentView, user]);

  const handleReload = () => {
    window.location.reload();
  };

  const handleLogout = async () => {
    await AuthService.logout();
    setUser(null);
    setView('dashboard'); // Reset view for next login
  };

  const handleSyncNow = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await SyncService.syncNow();
      await updateStats();
    } catch (error) {
      console.error('Sync failed', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (timestamp?: number) => {
    if (!timestamp || timestamp === 0) return 'Nunca sincronizado';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Hoje às ${timeStr}`;
    return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${timeStr}`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-sm font-bold uppercase tracking-widest">Carregando sessao...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={setUser} />;
  }

  const renderView = () => {
    switch(currentView) {
      case 'dashboard': return <Dashboard />;
      case 'products': return <Products />;
      case 'customers': return <Customers />;
      case 'sales': return <Sales />;
      case 'expenses': return <Expenses />;
      case 'categories': return <Categories />;
      case 'ai': return <Advisor />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfd] flex flex-col md:flex-row overflow-hidden">
      <Navigation currentView={currentView} setView={setView} />
      
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="flex-shrink-0 z-40 bg-[#fcfcfd]/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 md:px-12">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="md:hidden">
              <h1 className="text-xl font-black tracking-tighter text-slate-950 italic">MyBizPro.</h1>
            </div>
            <div className="hidden md:block">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Workspace / {currentView}</p>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={handleSyncNow}
                disabled={isSyncing}
                className={`flex items-center gap-3 bg-white border border-slate-200 pl-4 pr-2 py-1.5 rounded-full shadow-sm hover:border-indigo-200 transition-all active:scale-95 ${isSyncing ? 'opacity-80' : ''}`}
              >
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black uppercase tracking-tighter text-slate-950">
                    {isSyncing ? 'Sincronizando...' : syncStats.pendingCount > 0 ? `${syncStats.pendingCount} pendentes` : 'Sincronizado'}
                  </span>
                  <span className="text-[8px] font-medium text-slate-400 uppercase tracking-widest">
                    {formatLastSync(syncStats.lastSync)}
                  </span>
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${syncStats.pendingCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  <span className={`text-sm ${isSyncing ? 'animate-spin' : ''}`}>
                    {isSyncing ? '⌛' : syncStats.pendingCount > 0 ? '🔄' : '✅'}
                  </span>
                </div>
              </button>
              
              <button 
                onClick={handleLogout}
                className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center bg-white hover:bg-slate-50 transition-colors"
                title="Sair"
              >
                <img
                  src={user.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=6366f1&color=fff`}
                  alt={user.name}
                  className="w-8 h-8 rounded-full"
                />
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
          <div className="max-w-6xl mx-auto p-6 pb-32 md:p-12">
            {renderView()}
          </div>
        </div>
      </main>

      {showUpdateToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-sm">
          <button 
            onClick={handleReload}
            className="w-full bg-slate-950 text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between group border border-white/10"
          >
            <span className="text-xs font-black uppercase tracking-widest pl-2">🚀 Nova Versão Disponível</span>
            <span className="bg-white text-slate-950 px-3 py-1 rounded-full text-[10px] font-black group-hover:bg-indigo-400 transition-colors">ATUALIZAR</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default App;

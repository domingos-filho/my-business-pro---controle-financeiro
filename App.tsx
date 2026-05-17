import React, { useEffect, useRef, useState } from 'react';
import { AccessControl } from './components/AccessControl';
import { AccessStateScreen } from './components/AccessStateScreen';
import { Advisor } from './components/Advisor';
import { Categories } from './components/Categories';
import {
  CheckCircleIcon,
  ClockIcon,
  LogoutIcon,
  RefreshIcon,
  RocketIcon,
} from './components/AppIcons';
import { Auth } from './components/Auth';
import { BrandLogo } from './components/BrandLogo';
import { Customers } from './components/Customers';
import { Dashboard } from './components/Dashboard';
import { Expenses } from './components/Expenses';
import { Navigation } from './components/Navigation';
import { Products } from './components/Products';
import { Sales } from './components/Sales';
import { AuthService, User } from './services/AuthService';
import { SyncService, SyncStats } from './services/SyncService';

const VIEW_LABELS: Record<string, string> = {
  dashboard: 'Início',
  sales: 'Vendas',
  products: 'Produtos',
  customers: 'Clientes',
  expenses: 'Caixa',
  categories: 'Categorias',
  ai: 'IA',
  access: 'Controle de Acesso',
};

interface AccessIssue {
  code?: string;
  accessStatus?: string;
  error: string;
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [accessIssue, setAccessIssue] = useState<AccessIssue | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setView] = useState('dashboard');
  const [syncStats, setSyncStats] = useState<SyncStats>({ pendingCount: 0 });
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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
      if (restoredUser) {
        setAccessIssue(null);
      }
      setAuthLoading(false);
    };

    restore();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      setUser(null);
      setAccessIssue(null);
      setView('dashboard');
      setAuthLoading(false);
    };

    window.addEventListener('auth:unauthorized', handler);
    return () => {
      window.removeEventListener('auth:unauthorized', handler);
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<AccessIssue>;
      setUser(null);
      setView('dashboard');
      setAuthLoading(false);
      setAccessIssue(customEvent.detail || { error: 'Sua conta não pode acessar a aplicação.' });
    };

    window.addEventListener('auth:access-denied', handler as EventListener);
    return () => {
      window.removeEventListener('auth:access-denied', handler as EventListener);
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleReload = () => {
    window.location.reload();
  };

  const handleLogout = async () => {
    await AuthService.logout();
    setUser(null);
    setAccessIssue(null);
    setView('dashboard');
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
    const timeStr = date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (isToday) return `Hoje as ${timeStr}`;

    return `${date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    })} as ${timeStr}`;
  };

  const getTrialInfo = (currentUser: User) => {
    if (currentUser.accessStatus !== 'TRIAL' || !currentUser.trialEndsAt) return null;

    const expiresAt = new Date(currentUser.trialEndsAt);
    const remainingMs = currentUser.trialEndsAt - Date.now();
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

    return {
      remainingDays,
      expiresAtLabel: expiresAt.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    };
  };

  const getAccountStatusLabel = (currentUser: User, trial: ReturnType<typeof getTrialInfo>) => {
    if (currentUser.accessStatus === 'TRIAL') {
      if (!trial) return 'Conta teste';
      return trial.remainingDays > 0
        ? `Conta teste - ${trial.remainingDays} dia${trial.remainingDays === 1 ? '' : 's'} restantes`
        : 'Conta teste - expira hoje';
    }

    const labels: Record<string, string> = {
      ACTIVE: 'Ativa',
      PENDING: 'Pendente',
      SUSPENDED: 'Suspensa',
      CANCELLED: 'Cancelada',
      EXPIRED: 'Expirada',
      PAST_DUE: 'Pagamento pendente',
    };

    return labels[currentUser.accessStatus || ''] || 'Ativa';
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-sm font-bold uppercase tracking-widest">
          Carregando sessão...
        </div>
      </div>
    );
  }

  if (!user) {
    if (accessIssue) {
      return (
        <AccessStateScreen
          accessStatus={accessIssue.accessStatus}
          message={accessIssue.error}
          onBackToLogin={() => setAccessIssue(null)}
        />
      );
    }

    return <Auth onLogin={setUser} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'products':
        return <Products />;
      case 'customers':
        return <Customers />;
      case 'sales':
        return <Sales />;
      case 'expenses':
        return <Expenses />;
      case 'categories':
        return <Categories />;
      case 'ai':
        return <Advisor />;
      case 'access':
        return <AccessControl />;
      default:
        return <Dashboard />;
    }
  };

  const avatarSrc =
    user.avatar ??
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=6366f1&color=fff`;
  const currentViewLabel = VIEW_LABELS[currentView] || currentView;
  const trialInfo = getTrialInfo(user);
  const accountStatusLabel = getAccountStatusLabel(user, trialInfo);

  return (
    <div className="min-h-screen bg-[#fcfcfd] flex flex-col md:flex-row overflow-hidden">
      <Navigation currentView={currentView} setView={setView} isAdmin={user.isAdmin} />

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="flex-shrink-0 z-40 bg-[#fcfcfd]/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 md:px-12">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="md:hidden">
              <BrandLogo size="sm" />
            </div>

            <div className="hidden md:block">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                Workspace / {currentViewLabel}
              </p>
            </div>

            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen((current) => !current)}
                className="flex items-center gap-3 rounded-full border border-slate-200 bg-white py-1.5 pl-2 pr-3 shadow-sm transition-colors hover:bg-slate-50"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <img src={avatarSrc} alt={user.name} className="h-8 w-8 rounded-full" />
                <span className="hidden max-w-[130px] truncate text-[11px] font-black uppercase tracking-wide text-slate-700 sm:block">
                  {user.name}
                </span>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${
                    syncStats.pendingCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                  }`}
                >
                  {syncStats.pendingCount > 0 ? (
                    <ClockIcon className="h-4 w-4" />
                  ) : (
                    <CheckCircleIcon className="h-4 w-4" />
                  )}
                </span>
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-12 z-[120] w-[min(92vw,360px)] rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-200/80"
                >
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <img src={avatarSrc} alt={user.name} className="h-11 w-11 rounded-full" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Nome</p>
                      <p className="truncate text-sm font-black text-slate-950">{user.name}</p>
                    </div>
                  </div>

                  <div className="space-y-4 py-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">E-mail</p>
                      <p className="mt-1 break-all text-sm font-medium text-slate-700">{user.email}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status da conta</p>
                      <div className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide ${
                        user.accessStatus === 'TRIAL'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {user.accessStatus === 'TRIAL' ? <ClockIcon className="h-4 w-4" /> : <CheckCircleIcon className="h-4 w-4" />}
                        <span>{accountStatusLabel}</span>
                      </div>
                      {trialInfo && (
                        <p className="mt-2 text-xs font-medium text-slate-500">
                          Expira em {trialInfo.expiresAtLabel}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Sincronização</p>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {syncStats.pendingCount > 0 ? `${syncStats.pendingCount} pendente(s)` : 'Tudo sincronizado'}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-400">
                        Última sincronização: {formatLastSync(syncStats.lastSync)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
                    <button
                      onClick={handleSyncNow}
                      disabled={isSyncing}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition-all hover:border-indigo-300 hover:text-indigo-600 active:scale-95 disabled:opacity-60"
                    >
                      <RefreshIcon className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'Sincronizando' : 'Sincronizar'}
                    </button>
                    <button
                      onClick={handleLogout}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition-all hover:bg-slate-800 active:scale-95"
                    >
                      <LogoutIcon className="h-4 w-4" />
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
          <div className="max-w-6xl mx-auto p-6 pb-32 md:p-12">{renderView()}</div>
        </div>
      </main>

      {showUpdateToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-sm">
          <button
            onClick={handleReload}
            className="w-full bg-slate-950 text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between group border border-white/10"
          >
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest pl-2">
              <RocketIcon className="w-4 h-4" />
              <span>Nova versão disponível</span>
            </span>
            <span className="bg-white text-slate-950 px-3 py-1 rounded-full text-[10px] font-black group-hover:bg-indigo-400 transition-colors">
              ATUALIZAR
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default App;


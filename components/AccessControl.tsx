import React, { useEffect, useMemo, useState } from 'react';
import {
  AccessLogEntry,
  AccessSettings,
  AccessStatus,
  AccessUser,
  AdminAccessService,
  BillingInterval,
  InviteInfo,
  PlanInfo,
  SubscriptionInfo,
  SubscriptionStatus,
} from '../services/AdminAccessService';
import { CheckCircleIcon, ClockIcon, RefreshIcon, ShieldIcon, UsersIcon } from './AppIcons';
import {
  isValidEmail,
  normalizeEmail,
  normalizeText,
  parseNonNegativeFloat,
  parsePositiveInteger,
} from '../utils/input';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-amber-100 text-amber-700',
  TRIAL: 'bg-indigo-100 text-indigo-700',
  TRIALING: 'bg-indigo-100 text-indigo-700',
  SUSPENDED: 'bg-rose-100 text-rose-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
  EXPIRED: 'bg-slate-200 text-slate-700',
  PAST_DUE: 'bg-orange-100 text-orange-700',
};

const formatDate = (value: number | null) =>
  value
    ? new Date(value).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Nunca';

const formatMoney = (cents: number | null, currency = 'BRL') =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format((cents || 0) / 100);

const formatTrialStatus = (value: number | null) => {
  if (!value) return 'Sem data definida';

  const diffMs = value - Date.now();
  if (diffMs <= 0) return 'Expirado';

  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  return `${days} dia${days === 1 ? '' : 's'} restante${days === 1 ? '' : 's'}`;
};

export const AccessControl: React.FC = () => {
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [logs, setLogs] = useState<AccessLogEntry[]>([]);
  const [invites, setInvites] = useState<InviteInfo[]>([]);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionInfo[]>([]);
  const [settings, setSettings] = useState<AccessSettings | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [trialDays, setTrialDays] = useState(14);
  const [subscriptionUserId, setSubscriptionUserId] = useState('');
  const [subscriptionPlanId, setSubscriptionPlanId] = useState('');
  const [subscriptionPeriodDays, setSubscriptionPeriodDays] = useState(30);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('ACTIVE');
  const [planName, setPlanName] = useState('');
  const [planCode, setPlanCode] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planInterval, setPlanInterval] = useState<BillingInterval>('MONTH');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteAccessStatus, setInviteAccessStatus] = useState<AccessStatus>('TRIAL');
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState(7);
  const [generatedInviteLink, setGeneratedInviteLink] = useState('');
  const [summary, setSummary] = useState<{ total: number; filtered: number; byStatus: Partial<Record<AccessStatus, number>> }>({
    total: 0,
    filtered: 0,
    byStatus: {},
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const shouldScrollUsersList = users.length > 3;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsResponse, userResponse, logResponse, inviteResponse, planResponse, subscriptionResponse] = await Promise.all([
        AdminAccessService.getSettings(),
        AdminAccessService.listUsers({
          search: normalizeText(search, 120) || undefined,
          status: statusFilter || undefined,
        }),
        AdminAccessService.listLogs(),
        AdminAccessService.listInvites(),
        AdminAccessService.listPlans(),
        AdminAccessService.listSubscriptions(),
      ]);

      setSettings(settingsResponse);
      setTrialDays((current) => {
        if (!settings) return settingsResponse.defaultTrialDays;
        return settingsResponse.trialDayOptions.includes(current)
          ? current
          : settingsResponse.defaultTrialDays;
      });
      setUsers(userResponse.items);
      setSummary(userResponse.summary);
      setLogs(logResponse);
      setInvites(inviteResponse);
      setPlans(planResponse);
      setSubscriptions(subscriptionResponse);
      setInviteExpiresInDays((current) => (!settings ? settingsResponse.defaultInviteExpiresDays : current));
      setSubscriptionPeriodDays((current) => {
        if (!settings) return settingsResponse.defaultSubscriptionPeriodDays;
        return settingsResponse.subscriptionPeriodOptions.includes(current)
          ? current
          : settingsResponse.defaultSubscriptionPeriodDays;
      });
      setSubscriptionUserId((current) => current || (userResponse.items[0] ? String(userResponse.items[0].id) : ''));
      setSubscriptionPlanId((current) => current || (planResponse[0] ? String(planResponse[0].id) : ''));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar o controle de acesso.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const summaryCards = useMemo(
    () => [
      { label: 'Total de contas', value: summary.total, icon: UsersIcon, tone: 'bg-slate-100 text-slate-700' },
      { label: 'Pendentes', value: summary.byStatus.PENDING || 0, icon: ClockIcon, tone: 'bg-amber-100 text-amber-700' },
      { label: 'Ativas', value: summary.byStatus.ACTIVE || 0, icon: CheckCircleIcon, tone: 'bg-emerald-100 text-emerald-700' },
      { label: 'Em trial', value: summary.byStatus.TRIAL || 0, icon: ClockIcon, tone: 'bg-indigo-100 text-indigo-700' },
      { label: 'Suspensas', value: summary.byStatus.SUSPENDED || 0, icon: ShieldIcon, tone: 'bg-rose-100 text-rose-700' },
    ],
    [summary],
  );

  const handleUpdateStatus = async (user: AccessUser, accessStatus: AccessStatus) => {
    const reason =
      accessStatus === 'SUSPENDED' || accessStatus === 'CANCELLED'
        ? window.prompt('Informe o motivo desta alteração (opcional):', '') || undefined
        : undefined;

    try {
      await AdminAccessService.updateUserAccess(user.id, {
        accessStatus,
        reason,
      });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível alterar o acesso da conta.');
    }
  };

  const handleStartTrial = async (user: AccessUser) => {
    try {
      await AdminAccessService.updateUserAccess(user.id, {
        accessStatus: 'TRIAL',
        trialDays,
        reason: `Trial de ${trialDays} dias`,
      });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível iniciar o trial da conta.');
    }
  };

  const handleCreateInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const normalizedInviteEmail = normalizeEmail(inviteEmail);
    if (!isValidEmail(normalizedInviteEmail)) {
      setError('Informe um e-mail válido para o convite.');
      return;
    }

    try {
      const invite = await AdminAccessService.createInvite({
        email: normalizedInviteEmail,
        accessStatus: inviteAccessStatus,
        trialDays: inviteAccessStatus === 'TRIAL' ? trialDays : undefined,
        expiresInDays: inviteExpiresInDays,
      });
      setGeneratedInviteLink(`${window.location.origin}/?invite=${invite.token}`);
      setInviteEmail('');
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível criar o convite.');
    }
  };

  const handleRevokeInvite = async (invite: InviteInfo) => {
    try {
      await AdminAccessService.revokeInvite(invite.id);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível revogar o convite.');
    }
  };

  const handleCreatePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const normalizedPlanName = normalizeText(planName, 80);
    if (normalizedPlanName.length < 2) {
      setError('Informe um nome de plano com pelo menos 2 caracteres.');
      return;
    }

    const normalizedPlanCode = normalizeText(planCode, 60)
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '');

    const normalizedPrice = parseNonNegativeFloat(planPrice, -1);
    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
      setError('Informe um valor válido para o plano.');
      return;
    }

    try {
      const plan = await AdminAccessService.createPlan({
        code: normalizedPlanCode || undefined,
        name: normalizedPlanName,
        priceCents: Math.round(normalizedPrice * 100),
        currency: 'BRL',
        billingInterval: planInterval,
      });
      setPlanName('');
      setPlanCode('');
      setPlanPrice('');
      setSubscriptionPlanId(String(plan.id));
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível criar o plano.');
    }
  };

  const handleCreateSubscription = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const userId = parsePositiveInteger(subscriptionUserId);
    const planId = parsePositiveInteger(subscriptionPlanId);

    if (!userId || !planId) {
      setError('Selecione usuário e plano para criar a assinatura.');
      return;
    }

    try {
      await AdminAccessService.createUserSubscription(userId, {
        planId,
        status: subscriptionStatus,
        periodDays: subscriptionPeriodDays,
      });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível criar a assinatura.');
    }
  };

  const handleUpdateSubscription = async (subscription: SubscriptionInfo, status: SubscriptionStatus) => {
    try {
      await AdminAccessService.updateSubscription(subscription.id, {
        status,
        periodDays: subscriptionPeriodDays,
      });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível alterar a assinatura.');
    }
  };

  const getInviteStateLabel = (invite: InviteInfo) => {
    if (invite.usedAt) return 'Usado';
    if (invite.revokedAt) return 'Revogado';
    if (invite.expiresAt <= Date.now()) return 'Expirado';
    return 'Ativo';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Controle de Acesso</h2>
          <p className="text-sm font-medium text-slate-500">
            Aprove, suspenda e acompanhe o status comercial das contas que usam a aplicação.
          </p>
          {settings && (
            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              Cadastro novo: {settings.registrationAccessStatus} / {settings.registrationAccessMode}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg transition-all active:scale-95 disabled:opacity-60"
        >
          <RefreshIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Atualizando...' : 'Atualizar dados'}</span>
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{card.label}</p>
                  <p className="mt-2 text-3xl font-black text-slate-950">{card.value}</p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm space-y-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_180px_auto]">
          <div>
            <label className="ml-1 mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">
              Buscar conta
            </label>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onBlur={(event) => setSearch(normalizeText(event.target.value, 120))}
              placeholder="Nome ou e-mail"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
              maxLength={120}
            />
          </div>

          <div>
            <label className="ml-1 mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos</option>
              <option value="PENDING">Pendentes</option>
              <option value="ACTIVE">Ativas</option>
              <option value="TRIAL">Trial</option>
              <option value="SUSPENDED">Suspensas</option>
              <option value="CANCELLED">Canceladas</option>
              <option value="EXPIRED">Expiradas</option>
            </select>
          </div>

          <div>
            <label className="ml-1 mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">
              Dias de trial
            </label>
            <select
              value={trialDays}
              onChange={(event) => setTrialDays(parsePositiveInteger(event.target.value, trialDays))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {(settings?.trialDayOptions || [7, 14, 30]).map((option) => (
                <option key={option} value={option}>
                  {option} dias
                  {settings?.defaultTrialDays === option ? ' (padrão)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={load}
            className="h-[52px] self-end rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition-all hover:border-indigo-300 hover:text-indigo-600 active:scale-95"
          >
            Aplicar filtros
          </button>
        </div>

        <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50/40 p-3">
          <div
            className={`space-y-4 ${
              shouldScrollUsersList
                ? 'max-h-[78vh] overflow-y-auto pr-2 md:max-h-[70vh] xl:max-h-[44rem]'
                : ''
            }`}
          >
            {users.map((user) => (
              <article key={user.id} className="rounded-[1.75rem] border border-slate-100 bg-slate-50/60 p-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-slate-950">{user.name}</h3>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${STATUS_STYLES[user.accessStatus] || 'bg-slate-100 text-slate-700'}`}>
                      {user.accessStatus}
                    </span>
                    {user.isAdmin && (
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-indigo-700">
                        Admin
                      </span>
                    )}
                    {user.accessStatus === 'TRIAL' && !user.effectiveAccessAllowed && (
                      <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-rose-700">
                        Trial expirado
                      </span>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">E-mail</p>
                      <p className="mt-1 text-sm font-medium text-slate-700 break-all">{user.email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Modo</p>
                      <p className="mt-1 text-sm font-medium text-slate-700">{user.accessMode}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Criada em</p>
                      <p className="mt-1 text-sm font-medium text-slate-700">{formatDate(user.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Último login</p>
                      <p className="mt-1 text-sm font-medium text-slate-700">{formatDate(user.lastLoginAt)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Trial</p>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {user.accessStatus === 'TRIAL'
                          ? `${formatTrialStatus(user.trialEndsAt)} - ${formatDate(user.trialEndsAt)}`
                          : 'Não aplicado'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 xl:min-w-[190px]">
                  {user.accessStatus !== 'ACTIVE' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(user, 'ACTIVE')}
                      className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition-all hover:bg-emerald-700 active:scale-95"
                    >
                      Aprovar / Ativar
                    </button>
                  )}
                  {user.accessStatus !== 'SUSPENDED' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(user, 'SUSPENDED')}
                      className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white transition-all hover:bg-rose-700 active:scale-95"
                    >
                      Suspender
                    </button>
                  )}
                  {user.accessStatus !== 'TRIAL' && (
                    <button
                      type="button"
                      onClick={() => handleStartTrial(user)}
                      className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white transition-all hover:bg-indigo-700 active:scale-95"
                    >
                      Iniciar trial
                    </button>
                  )}
                  {user.accessStatus === 'TRIAL' && (
                    <button
                      type="button"
                      onClick={() => handleStartTrial(user)}
                      className="rounded-2xl border border-indigo-200 bg-white px-4 py-3 text-sm font-black text-indigo-700 transition-all hover:border-indigo-300 hover:bg-indigo-50 active:scale-95"
                    >
                      Renovar trial
                    </button>
                  )}
                  {user.accessStatus !== 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(user, 'PENDING')}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition-all hover:border-amber-300 hover:text-amber-700 active:scale-95"
                    >
                      Voltar para pendente
                    </button>
                  )}
                </div>
              </div>
              </article>
            ))}

            {!users.length && !loading && (
              <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                <p className="text-lg font-black text-slate-800">Nenhuma conta encontrada</p>
                <p className="mt-2 text-sm font-medium text-slate-400">
                  Ajuste os filtros ou aguarde novos cadastros.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Assinaturas</p>
            <h3 className="mt-2 text-xl font-black text-slate-950">Controle comercial recorrente</h3>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Use esta base manual até conectar um gateway de pagamento. Status inadimplente, cancelado ou expirado bloqueia o acesso.
            </p>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {subscriptions.length} assinatura{subscriptions.length === 1 ? '' : 's'} registrada{subscriptions.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form onSubmit={handleCreatePlan} className="rounded-[1.75rem] border border-slate-100 bg-slate-50/60 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Planos</p>
            <h4 className="mt-2 text-lg font-black text-slate-950">Criar plano</h4>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="ml-1 mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Nome
                </label>
                <input
                  type="text"
                  value={planName}
                  onChange={(event) => setPlanName(event.target.value)}
                  onBlur={(event) => setPlanName(normalizeText(event.target.value, 80))}
                  placeholder="Profissional"
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  maxLength={80}
                  required
                />
              </div>

              <div>
                <label className="ml-1 mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Código
                </label>
                <input
                  type="text"
                  value={planCode}
                  onChange={(event) => setPlanCode(event.target.value)}
                  onBlur={(event) =>
                    setPlanCode(
                      normalizeText(event.target.value, 60)
                        .toLowerCase()
                        .replace(/\s+/g, '-')
                        .replace(/[^a-z0-9_-]/g, ''),
                    )
                  }
                  placeholder="professional"
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  maxLength={60}
                />
              </div>

              <div>
                <label className="ml-1 mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Valor
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={planPrice}
                  onChange={(event) => setPlanPrice(event.target.value)}
                  onBlur={(event) => {
                    const parsed = parseNonNegativeFloat(event.target.value, -1);
                    setPlanPrice(parsed >= 0 ? parsed.toFixed(2) : '');
                  }}
                  placeholder="49,90"
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="ml-1 mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Intervalo
                </label>
                <select
                  value={planInterval}
                  onChange={(event) => setPlanInterval(event.target.value as BillingInterval)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="MONTH">Mensal</option>
                  <option value="YEAR">Anual</option>
                  <option value="LIFETIME">Vitalício</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="mt-4 w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition-all hover:bg-slate-800 active:scale-95"
            >
              Criar plano
            </button>

            <div className="mt-4 space-y-2">
              {plans.slice(0, 4).map((plan) => (
                <div key={plan.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-950 truncate">{plan.name}</p>
                    <p className="text-xs font-bold text-slate-400">
                      {plan.code} - {formatMoney(plan.priceCents, plan.currency)} / {plan.billingInterval}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${plan.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                    {plan.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              ))}
            </div>
          </form>

          <form onSubmit={handleCreateSubscription} className="rounded-[1.75rem] border border-slate-100 bg-slate-50/60 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Nova assinatura</p>
            <h4 className="mt-2 text-lg font-black text-slate-950">Ativar cliente</h4>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="ml-1 mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Conta
                </label>
                <select
                  value={subscriptionUserId}
                  onChange={(event) =>
                    setSubscriptionUserId(String(parsePositiveInteger(event.target.value)))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} - {user.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="ml-1 mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Plano
                </label>
                <select
                  value={subscriptionPlanId}
                  onChange={(event) =>
                    setSubscriptionPlanId(String(parsePositiveInteger(event.target.value)))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  {plans.filter((plan) => plan.isActive).map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - {formatMoney(plan.priceCents, plan.currency)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="ml-1 mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Status
                </label>
                <select
                  value={subscriptionStatus}
                  onChange={(event) => setSubscriptionStatus(event.target.value as SubscriptionStatus)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ACTIVE">Ativa</option>
                  <option value="TRIALING">Trial comercial</option>
                  <option value="PAST_DUE">Inadimplente</option>
                </select>
              </div>

              <div>
                <label className="ml-1 mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Período
                </label>
                <select
                  value={subscriptionPeriodDays}
                  onChange={(event) =>
                    setSubscriptionPeriodDays(parsePositiveInteger(event.target.value, subscriptionPeriodDays))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {(settings?.subscriptionPeriodOptions || [30, 90, 365]).map((option) => (
                    <option key={option} value={option}>
                      {option} dias
                      {settings?.defaultSubscriptionPeriodDays === option ? ' (padrão)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={!plans.length || !users.length}
              className="mt-4 w-full rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
            >
              Criar assinatura
            </button>
          </form>
        </div>

        <div className="space-y-3">
          {subscriptions.slice(0, 8).map((subscription) => (
            <article key={subscription.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-slate-950 break-all">{subscription.userName || subscription.userEmail}</p>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${STATUS_STYLES[subscription.status] || 'bg-slate-100 text-slate-700'}`}>
                      {subscription.status}
                    </span>
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700">
                      {subscription.gateway || 'manual'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-500">
                    {subscription.planName || 'Plano'} - {formatMoney(subscription.planPriceCents, subscription.planCurrency || 'BRL')}
                    {' | '}Período até{' '}
                    {subscription.currentPeriodEnd
                      ? formatDate(subscription.currentPeriodEnd)
                      : subscription.planBillingInterval === 'LIFETIME'
                        ? 'Vitalício'
                        : 'Sem data'}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-400 break-all">
                    {subscription.userEmail}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[460px]">
                  <button
                    type="button"
                    onClick={() => handleUpdateSubscription(subscription, 'ACTIVE')}
                    className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition-all hover:bg-emerald-700 active:scale-95"
                  >
                    Renovar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateSubscription(subscription, 'PAST_DUE')}
                    className="rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm font-black text-orange-700 transition-all hover:bg-orange-50 active:scale-95"
                  >
                    Inadimplente
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateSubscription(subscription, 'CANCELLED')}
                    className="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-black text-rose-700 transition-all hover:bg-rose-50 active:scale-95"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </article>
          ))}

          {!subscriptions.length && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-400">
              Nenhuma assinatura criada ainda.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm space-y-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Convites</p>
            <h3 className="mt-2 text-xl font-black text-slate-950">Links de acesso controlado</h3>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Expiram em {inviteExpiresInDays} dia{inviteExpiresInDays === 1 ? '' : 's'}
          </p>
        </div>

        <form onSubmit={handleCreateInvite} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_180px_160px_auto]">
          <div>
            <label className="ml-1 mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">
              E-mail convidado
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              onBlur={(event) => setInviteEmail(normalizeEmail(event.target.value))}
              placeholder="cliente@email.com"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
              maxLength={160}
              required
            />
          </div>

          <div>
            <label className="ml-1 mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">
              Acesso inicial
            </label>
            <select
              value={inviteAccessStatus}
              onChange={(event) => setInviteAccessStatus(event.target.value as AccessStatus)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="TRIAL">Trial</option>
              <option value="ACTIVE">Ativo</option>
              <option value="PENDING">Pendente</option>
            </select>
          </div>

          <div>
            <label className="ml-1 mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">
              Dias de trial
            </label>
            <select
              value={trialDays}
              onChange={(event) => setTrialDays(parsePositiveInteger(event.target.value, trialDays))}
              disabled={inviteAccessStatus !== 'TRIAL'}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {(settings?.trialDayOptions || [7, 14, 30]).map((option) => (
                <option key={option} value={option}>
                  {option} dias
                  {settings?.defaultTrialDays === option ? ' (padrão)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="ml-1 mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">
              Validade
            </label>
            <select
              value={inviteExpiresInDays}
              onChange={(event) =>
                setInviteExpiresInDays(parsePositiveInteger(event.target.value, inviteExpiresInDays))
              }
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-slate-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {[3, 7, 14, 30].map((option) => (
                <option key={option} value={option}>
                  {option} dias
                  {settings?.defaultInviteExpiresDays === option ? ' (padrão)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="h-[52px] self-end rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition-all hover:bg-slate-800 active:scale-95"
          >
            Criar convite
          </button>
        </form>

        {generatedInviteLink && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-emerald-700">
              Link gerado
            </label>
            <div className="flex flex-col gap-3 lg:flex-row">
              <input
                readOnly
                value={generatedInviteLink}
                className="min-w-0 flex-1 rounded-2xl border border-emerald-200 bg-white p-3 text-sm font-medium text-slate-700"
              />
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(generatedInviteLink)}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition-all hover:bg-emerald-700 active:scale-95"
              >
                Copiar link
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {invites.slice(0, 8).map((invite) => (
            <article key={invite.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-slate-950 break-all">{invite.email}</p>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${STATUS_STYLES[invite.accessStatus] || 'bg-slate-100 text-slate-700'}`}>
                      {invite.accessStatus}
                    </span>
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700">
                      {getInviteStateLabel(invite)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-500">
                    Expira em {formatDate(invite.expiresAt)}
                    {invite.trialDays ? ` - trial de ${invite.trialDays} dias` : ''}
                    {invite.usedByEmail ? ` - usado por ${invite.usedByEmail}` : ''}
                  </p>
                </div>

                {invite.active && (
                  <button
                    type="button"
                    onClick={() => handleRevokeInvite(invite)}
                    className="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-black text-rose-700 transition-all hover:bg-rose-50 active:scale-95"
                  >
                    Revogar
                  </button>
                )}
              </div>
            </article>
          ))}

          {!invites.length && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-400">
              Nenhum convite criado ainda.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm space-y-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Auditoria</p>
          <h3 className="mt-2 text-xl font-black text-slate-950">Últimas alterações de acesso</h3>
        </div>

        <div className="space-y-3">
          {logs.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {entry.userName} ({entry.userEmail})
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {entry.previousStatus || 'N/A'} {'->'} {entry.newStatus || 'N/A'}
                    {entry.reason ? ` • ${entry.reason}` : ''}
                  </p>
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {formatDate(entry.createdAt)}
                </div>
              </div>
            </div>
          ))}

          {!logs.length && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-400">
              Nenhum log de acesso registrado ainda.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};


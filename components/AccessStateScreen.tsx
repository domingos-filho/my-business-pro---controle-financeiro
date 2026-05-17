import React from 'react';
import { AlertTriangleIcon, ShieldIcon } from './AppIcons';
import { BrandLogo } from './BrandLogo';

interface AccessStateScreenProps {
  accessStatus?: string | null;
  title?: string;
  message: string;
  onBackToLogin: () => void;
}

const STATUS_COPY: Record<string, { title: string; accent: string }> = {
  PENDING: { title: 'Conta aguardando aprovação', accent: 'text-amber-500' },
  SUSPENDED: { title: 'Conta suspensa', accent: 'text-rose-500' },
  CANCELLED: { title: 'Conta cancelada', accent: 'text-rose-500' },
  EXPIRED: { title: 'Acesso expirado', accent: 'text-amber-500' },
  PAST_DUE: { title: 'Pagamento pendente', accent: 'text-amber-500' },
};

export const AccessStateScreen: React.FC<AccessStateScreenProps> = ({
  accessStatus,
  title,
  message,
  onBackToLogin,
}) => {
  const statusCopy = STATUS_COPY[String(accessStatus || '').toUpperCase()] || {
    title: title || 'Acesso indisponível',
    accent: 'text-slate-500',
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-[2.5rem] border border-white/10 bg-white/95 p-8 shadow-2xl text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex h-18 w-18 items-center justify-center rounded-3xl bg-slate-950 text-white">
            <ShieldIcon className="h-9 w-9" />
          </div>
        </div>

        <BrandLogo size="sm" />

        <div className="space-y-3">
          <p className={`text-[11px] font-black uppercase tracking-[0.25em] ${statusCopy.accent}`}>
            Controle de acesso
          </p>
          <h2 className="text-3xl font-black text-slate-950">
            {title || statusCopy.title}
          </h2>
          <p className="text-sm leading-7 font-medium text-slate-600">{message}</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-left">
          <div className="flex items-start gap-3">
            <AlertTriangleIcon className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm leading-6 font-medium text-amber-800">
              Se você acredita que isso é um erro, revise o status da conta no painel administrativo
              ou entre em contato com o suporte responsável pela comercialização do sistema.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBackToLogin}
          className="w-full rounded-2xl bg-slate-950 px-6 py-4 text-lg font-black text-white shadow-xl transition-all active:scale-[0.98] hover:bg-slate-800"
        >
          Voltar para o login
        </button>
      </div>
    </div>
  );
};


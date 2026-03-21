import React, { useState } from 'react';
import { AuthService, User } from '../services/AuthService';

interface AuthProps {
  onLogin: (user: User) => void;
}

type AuthStep = 'welcome' | 'login' | 'signup';

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [step, setStep] = useState<AuthStep>('welcome');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const socialLoginEnabled = import.meta.env.VITE_ENABLE_SOCIAL_LOGIN === 'true';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const goToStep = (nextStep: AuthStep) => {
    setErrorMessage('');
    setStep(nextStep);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setErrorMessage('');
    setLoading(true);
    try {
      const user = await AuthService.loginWithEmail(email, password);
      onLogin(user);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    setErrorMessage('');
    setLoading(true);
    try {
      const user = await AuthService.register(name, email, password);
      onLogin(user);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setErrorMessage('');
    setSocialLoading(provider);
    try {
      const user = await AuthService.loginWithSocial(provider);
      onLogin(user);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `Erro ao entrar com ${provider}.`);
    } finally {
      setSocialLoading(null);
    }
  };

  const inputClasses =
    'w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all shadow-sm placeholder:text-slate-300';
  const labelClasses =
    'block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5';
  const socialBtnClasses =
    'w-full py-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-center gap-3 font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98] shadow-sm disabled:opacity-50';

  if (step === 'welcome') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center animate-fadeIn relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-indigo-600/20 blur-[100px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-purple-600/10 blur-[100px] rounded-full"></div>

        <div className="relative z-10 w-full max-w-xs">
          <div className="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-[2.5rem] flex items-center justify-center text-4xl shadow-2xl shadow-indigo-500/40 mb-10 mx-auto animate-pulse">
            *
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter mb-4">
            MyBizPro<span className="text-indigo-500">.</span>
          </h1>
          <p className="text-slate-400 font-medium leading-relaxed mb-14">
            Gestao inteligente para artesaos e criadores de produtos personalizados.
          </p>

          <div className="space-y-4">
            <button
              onClick={() => goToStep('signup')}
              className="w-full bg-white text-slate-950 py-[18px] rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all"
            >
              Criar Conta Gratis
            </button>
            <button
              onClick={() => goToStep('login')}
              className="w-full bg-white/5 text-white border border-white/10 py-[18px] rounded-2xl font-black text-lg hover:bg-white/10 transition-all active:scale-95 backdrop-blur-sm"
            >
              Fazer Login
            </button>
          </div>

          <p className="mt-16 text-slate-600 text-[10px] font-bold uppercase tracking-[0.4em]">
            PWA VERSION 2.1
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfd] flex flex-col items-center justify-center p-6 animate-fadeIn">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <button
            onClick={() => goToStep('welcome')}
            className="inline-flex items-center gap-2 text-slate-400 text-xs font-black uppercase tracking-widest mb-6 hover:text-indigo-600 transition-colors group"
          >
            <span className="group-hover:-translate-x-1 transition-transform">&lt;-</span> Inicio
          </button>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">
            {step === 'login' ? 'Bem-vindo!' : 'Nova Conta'}
          </h2>
          <p className="text-slate-500 font-medium mt-2">
            {step === 'login' ? 'Continue de onde parou.' : 'Organize seu caixa em minutos.'}
          </p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 space-y-6 animate-slideUp">
          <form onSubmit={step === 'login' ? handleLogin : handleRegister} className="space-y-4">
            {step === 'signup' && (
              <div>
                <label className={labelClasses}>Nome Profissional</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClasses}
                  placeholder="Nome do seu negocio"
                  required
                />
              </div>
            )}

            <div>
              <label className={labelClasses}>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClasses}
                placeholder="exemplo@email.com"
                required
              />
            </div>

            <div>
              <label className={labelClasses}>Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClasses}
                placeholder="**********"
                required
              />
              {step === 'signup' && (
                <p className="mt-2 ml-1 text-[11px] font-medium text-slate-400">
                  Use no minimo 10 caracteres com letra maiuscula, minuscula e numero.
                </p>
              )}
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !!socialLoading}
              className={`w-full text-white py-[18px] rounded-2xl font-black transition-all active:scale-[0.98] shadow-xl text-lg mt-2 disabled:opacity-50 ${
                step === 'signup' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-950 hover:bg-slate-800'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Entrando...
                </span>
              ) : step === 'login' ? (
                'Entrar'
              ) : (
                'Comecar Agora'
              )}
            </button>
          </form>

          {socialLoginEnabled && (
            <>
              <div className="relative flex items-center justify-center py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100"></div>
                </div>
                <span className="relative bg-white px-4 text-xs font-black text-slate-300 uppercase tracking-widest">
                  ou entre com
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleSocialLogin('google')}
                  disabled={loading || !!socialLoading}
                  className={socialBtnClasses}
                >
                  {socialLoading === 'google' ? (
                    <span className="w-5 h-5 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <img
                        src="https://cdn-icons-png.flaticon.com/512/2991/2991148.png"
                        className="w-5 h-5"
                        alt="Google"
                      />
                      <span className="text-sm">Google</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleSocialLogin('apple')}
                  disabled={loading || !!socialLoading}
                  className={socialBtnClasses}
                >
                  {socialLoading === 'apple' ? (
                    <span className="w-5 h-5 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <img
                        src="https://cdn-icons-png.flaticon.com/512/0/747.png"
                        className="w-5 h-5"
                        alt="Apple"
                      />
                      <span className="text-sm">Apple</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          <div className="text-center">
            <button
              type="button"
              onClick={() => goToStep(step === 'login' ? 'signup' : 'login')}
              className="text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors"
            >
              {step === 'login' ? 'Nao tem conta?' : 'Ja possui conta?'}{' '}
              <span className="text-indigo-600 font-black">
                {step === 'login' ? 'Cadastre-se' : 'Entrar'}
              </span>
            </button>
          </div>
        </div>

        <p className="text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">
          Sua conta e sincronizada automaticamente com a nuvem.
        </p>
      </div>
    </div>
  );
};

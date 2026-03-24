import React, { useEffect, useRef } from 'react';
import {
  BoxIcon,
  HomeIcon,
  SalesIcon,
  SparkBrainIcon,
  TagIcon,
  UsersIcon,
  WalletIcon,
} from './AppIcons';
import { BrandLogo } from './BrandLogo';

interface NavigationProps {
  currentView: string;
  setView: (view: string) => void;
}

type NavIconComponent = React.ComponentType<{ className?: string }>;

interface NavItem {
  id: string;
  label: string;
  icon: NavIconComponent;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, setView }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const items: NavItem[] = [
    { id: 'dashboard', label: 'INICIO', icon: HomeIcon },
    { id: 'sales', label: 'VENDAS', icon: SalesIcon },
    { id: 'products', label: 'PRODUTOS', icon: BoxIcon },
    { id: 'customers', label: 'CLIENTES', icon: UsersIcon },
    { id: 'expenses', label: 'CAIXA', icon: WalletIcon },
    { id: 'categories', label: 'CATEGORIAS', icon: TagIcon },
    { id: 'ai', label: 'IA', icon: SparkBrainIcon },
  ];

  useEffect(() => {
    const activeElem = document.getElementById(`nav-mob-${currentView}`);
    if (activeElem && scrollRef.current) {
      const scrollContainer = scrollRef.current;
      const scrollLeft =
        activeElem.offsetLeft - scrollContainer.offsetWidth / 2 + activeElem.offsetWidth / 2;
      scrollContainer.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [currentView]);

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] h-[110px] pointer-events-none flex items-end">
        <div className="w-full bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 shadow-[0_-10px_40px_rgba(79,70,229,0.3)] relative pointer-events-auto pb-safe">
          <nav
            ref={scrollRef}
            className="magic-nav-container flex items-center h-[75px] overflow-x-auto no-scrollbar scroll-smooth px-[35vw]"
          >
            <div className="flex items-center gap-0">
              {items.map((item) => {
                const isActive = currentView === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    id={`nav-mob-${item.id}`}
                    onClick={() => setView(item.id)}
                    className={`magic-nav-item relative flex flex-col items-center justify-center h-full transition-all duration-300 ${isActive ? 'active' : ''}`}
                  >
                    <div className="icon-circle relative w-14 h-14 flex items-center justify-center rounded-full transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] z-20">
                      <Icon
                        className={`icon-svg w-6 h-6 transition-all duration-300 ${
                          isActive ? '' : 'text-white/45 scale-90'
                        }`}
                      />
                    </div>

                    <span
                      className={`absolute bottom-3 text-[10px] font-black tracking-tighter transition-all duration-300 ${
                        isActive ? 'text-white animate-label' : 'opacity-0 translate-y-2'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="h-[env(safe-area-inset-bottom)]"></div>
        </div>
      </div>

      <aside className="hidden md:flex flex-col w-20 lg:w-72 h-screen sticky top-0 bg-gradient-to-b from-indigo-700 to-purple-700 border-r border-white/10 flex-shrink-0 z-50">
        <div className="p-8 pb-12">
          <BrandLogo theme="light" size="md" showTagline />
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {items.map((item) => {
            const isActive = currentView === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`w-full flex items-center rounded-2xl transition-all duration-300 group px-5 py-4 ${
                  isActive
                    ? 'bg-white text-indigo-600 shadow-2xl shadow-indigo-900/20 translate-x-1'
                    : 'text-indigo-100/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="w-8 flex justify-center">
                  <Icon
                    className={`w-5 h-5 transition-transform ${
                      isActive ? 'scale-110' : 'group-hover:scale-110 opacity-70'
                    }`}
                  />
                </div>
                <span
                  className={`hidden lg:block ml-4 text-sm font-bold tracking-tight ${
                    isActive ? 'text-indigo-600' : 'text-indigo-100/70 group-hover:text-white'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

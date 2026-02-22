
import React, { useRef, useEffect } from 'react';

interface NavigationProps {
  currentView: string;
  setView: (view: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, setView }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const items = [
    { id: 'dashboard', label: 'INÍCIO', icon: '🏠' },
    { id: 'sales', label: 'VENDAS', icon: '💜' },
    { id: 'products', label: 'ITENS', icon: '📦' },
    { id: 'customers', label: 'CLIENTES', icon: '👥' },
    { id: 'expenses', label: 'CAIXA', icon: '💸' },
    { id: 'categories', label: 'CATEGORIAS', icon: '🏷️' },
    { id: 'ai', label: 'IA', icon: '🤖' }
  ];

  // Auto-scroll para centralizar o item ativo ao mudar de view
  useEffect(() => {
    const activeElem = document.getElementById(`nav-mob-${currentView}`);
    if (activeElem && scrollRef.current) {
      const scrollContainer = scrollRef.current;
      const scrollLeft = activeElem.offsetLeft - (scrollContainer.offsetWidth / 2) + (activeElem.offsetWidth / 2);
      scrollContainer.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [currentView]);

  return (
    <>
      {/* MOBILE: FULL WIDTH MAGIC NAVIGATION */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] h-[110px] pointer-events-none flex items-end">
        <div className="w-full bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 shadow-[0_-10px_40px_rgba(79,70,229,0.3)] relative pointer-events-auto pb-safe">
          
          {/* Scrollable container */}
          <nav 
            ref={scrollRef}
            className="magic-nav-container flex items-center h-[75px] overflow-x-auto no-scrollbar scroll-smooth px-[35vw]"
          >
            <div className="flex items-center gap-0">
              {items.map(item => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav-mob-${item.id}`}
                    onClick={() => setView(item.id)}
                    className={`magic-nav-item relative flex flex-col items-center justify-center h-full transition-all duration-300 ${isActive ? 'active' : ''}`}
                  >
                    {/* Circle Indicator (O círculo branco que sobe) */}
                    <div className="icon-circle relative w-14 h-14 flex items-center justify-center rounded-full transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] z-20">
                      <span className={`icon-span text-2xl transition-all duration-300 ${isActive ? '' : 'grayscale-0 opacity-40 scale-90'}`}>
                        {item.icon}
                      </span>
                    </div>

                    {/* Label (Posicionada fixamente abaixo da área do bump) */}
                    <span className={`absolute bottom-3 text-[10px] font-black tracking-tighter transition-all duration-300 ${
                      isActive ? 'text-white animate-label' : 'opacity-0 translate-y-2'
                    }`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Safe Area Spacer for modern phones */}
          <div className="h-[env(safe-area-inset-bottom)]"></div>
        </div>
      </div>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-20 lg:w-72 h-screen sticky top-0 bg-gradient-to-b from-indigo-700 to-purple-700 border-r border-white/10 flex-shrink-0 z-50">
        <div className="p-8 pb-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-xl shadow-xl shadow-indigo-900/20">💎</div>
            <div className="hidden lg:block">
              <h1 className="text-xl font-black tracking-tighter text-white italic leading-none">MyBizPro.</h1>
              <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest">Financial Studio</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {items.map(item => {
            const isActive = currentView === item.id;
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
                  <span className={`text-xl transition-transform ${isActive ? 'scale-110 grayscale-0' : 'group-hover:scale-110 grayscale-0 opacity-70'}`}>
                    {item.icon}
                  </span>
                </div>
                <span className={`hidden lg:block ml-4 text-sm font-bold tracking-tight ${isActive ? 'text-indigo-600' : 'text-indigo-100/70 group-hover:text-white'}`}>
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

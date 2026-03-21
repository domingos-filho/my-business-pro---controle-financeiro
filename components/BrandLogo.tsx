import React from 'react';
import logoMark from '../assets/mybizpro-mark.svg';

interface BrandLogoProps {
  theme?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'hero';
  layout?: 'horizontal' | 'stacked';
  showTagline?: boolean;
  className?: string;
}

const iconSizeMap = {
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-14 h-14',
  hero: 'w-24 h-24',
};

const titleSizeMap = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
  hero: 'text-5xl',
};

const taglineSizeMap = {
  sm: 'text-[9px]',
  md: 'text-[10px]',
  lg: 'text-[11px]',
  hero: 'text-[11px]',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  theme = 'dark',
  size = 'md',
  layout = 'horizontal',
  showTagline = false,
  className = '',
}) => {
  const titleColor = theme === 'dark' ? 'text-slate-950' : 'text-white';
  const accentColor = theme === 'dark' ? 'text-slate-400' : 'text-white/55';
  const layoutClasses =
    layout === 'stacked'
      ? 'flex-col items-center text-center'
      : 'flex-row items-center text-left';

  return (
    <div className={`flex ${layoutClasses} gap-3 ${className}`}>
      <img
        src={logoMark}
        alt="MyBizPro"
        className={`${iconSizeMap[size]} shrink-0 select-none`}
      />

      <div className={layout === 'stacked' ? 'space-y-1' : 'space-y-0.5'}>
        <div className={`${titleSizeMap[size]} ${titleColor} font-black tracking-tighter leading-none`}>
          MyBizPro<span className="text-indigo-500">.</span>
        </div>
        {showTagline && (
          <div className={`${taglineSizeMap[size]} ${accentColor} font-bold uppercase tracking-[0.28em]`}>
            Controle Financeiro
          </div>
        )}
      </div>
    </div>
  );
};

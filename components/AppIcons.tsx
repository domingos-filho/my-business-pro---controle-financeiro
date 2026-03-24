import React from 'react';

interface IconProps {
  className?: string;
}

const baseProps = {
  fill: 'none',
  viewBox: '0 0 24 24',
  strokeWidth: 1.9,
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const HomeIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M3 10.8 12 4l9 6.8" />
    <path d="M5.5 9.8V20h13V9.8" />
    <path d="M9.5 20v-5.5h5V20" />
  </svg>
);

export const SalesIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M5 17.5V8.5" />
    <path d="M12 17.5V5.5" />
    <path d="M19 17.5V11.5" />
    <path d="M3.5 20h17" />
  </svg>
);

export const BoxIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M12 3 4.5 7 12 11l7.5-4L12 3Z" />
    <path d="M4.5 7v10L12 21l7.5-4V7" />
    <path d="M12 11v10" />
  </svg>
);

export const UsersIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    <path d="M15.5 12.5a2.5 2.5 0 1 0 0-5" />
    <path d="M4.5 19c.6-2.3 2.4-3.5 4.5-3.5s3.9 1.2 4.5 3.5" />
    <path d="M14.5 18c.4-1.5 1.5-2.4 3-2.7" />
  </svg>
);

export const WalletIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H18a2 2 0 0 1 2 2v1.5H6.5A2.5 2.5 0 0 0 4 12v6.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
    <path d="M20 10.5h-4A2.5 2.5 0 0 0 13.5 13v0A2.5 2.5 0 0 0 16 15.5h4v-5Z" />
    <path d="M16.5 13h.01" />
  </svg>
);

export const TagIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M20 13 11 22l-8-8V4h10l7 7Z" />
    <path d="M7.5 8.5h.01" />
  </svg>
);

export const SparkBrainIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M10.5 4.5A3.5 3.5 0 0 0 7 8c0 .6.1 1.1.4 1.6A4.5 4.5 0 0 0 9 18h6a4 4 0 0 0 1.5-7.7A4 4 0 0 0 10.5 4.5Z" />
    <path d="M10 14c.7.6 1.3 1 2 1s1.3-.4 2-1" />
    <path d="M9.5 11.5h.01" />
    <path d="M14.5 11.5h.01" />
    <path d="M18.5 3.5 19 5l1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z" />
  </svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M20 12a8 8 0 0 0-13.7-5.7" />
    <path d="M4 4v4h4" />
    <path d="M4 12a8 8 0 0 0 13.7 5.7" />
    <path d="M20 20v-4h-4" />
  </svg>
);

export const CheckCircleIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    <path d="m8.5 12.5 2.2 2.2 4.8-5" />
  </svg>
);

export const ClockIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
    <path d="M12 7.5v5l3 1.8" />
  </svg>
);

export const RocketIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M14.5 4.5c2.4.2 4.3 2.1 4.5 4.5-.4 3.5-2.4 6.8-5.7 8.8l-2.1 1.3-1.3-2.1C7.9 13.7 5.9 10.4 5.5 7c.2-2.4 2.1-4.3 4.5-4.5L12 6l2.5-1.5Z" />
    <path d="M9 9h.01" />
    <path d="M15 9h.01" />
    <path d="m8 16-2.5 2.5" />
    <path d="m16 16 2.5 2.5" />
  </svg>
);

export const RobotIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M9 3.5h6" />
    <path d="M12 3.5v2" />
    <rect x="5" y="6" width="14" height="11" rx="4" />
    <path d="M8.5 11h.01" />
    <path d="M15.5 11h.01" />
    <path d="M9 14.5c1 .7 2 .9 3 .9s2-.2 3-.9" />
    <path d="M8 20v-3" />
    <path d="M16 20v-3" />
  </svg>
);

export const BulbIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M12 3.5a5.5 5.5 0 0 0-3.8 9.5c.7.7 1.3 1.8 1.5 3h4.6c.2-1.2.8-2.3 1.5-3A5.5 5.5 0 0 0 12 3.5Z" />
    <path d="M10 19h4" />
    <path d="M10.5 21h3" />
  </svg>
);

export const ArrowRightIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

export const LogoutIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M10 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h3" />
    <path d="M13 12h7" />
    <path d="m17 8 4 4-4 4" />
  </svg>
);

export const IncomeIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M12 20V5" />
    <path d="m6.5 10.5 5.5-5.5 5.5 5.5" />
    <path d="M5 20h14" />
  </svg>
);

export const ExpenseIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M12 4v15" />
    <path d="m6.5 13.5 5.5 5.5 5.5-5.5" />
    <path d="M5 4h14" />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M4.5 7h15" />
    <path d="M9.5 3.5h5l1 2.5h-7l1-2.5Z" />
    <path d="M7 7l.7 11a1.5 1.5 0 0 0 1.5 1.4h5.6a1.5 1.5 0 0 0 1.5-1.4L17 7" />
    <path d="M10 10.5v5" />
    <path d="M14 10.5v5" />
  </svg>
);

export const EditIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="m14.5 5.5 4 4" />
    <path d="m4.5 19.5 3.4-.6 8.7-8.7a1.8 1.8 0 0 0 0-2.6l-1.2-1.2a1.8 1.8 0 0 0-2.6 0l-8.7 8.7-.6 3.4Z" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="m5.5 12.5 4 4 9-9" />
  </svg>
);

export const FolderIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M3.5 8.5A2.5 2.5 0 0 1 6 6h3l2 2h7a2.5 2.5 0 0 1 2.5 2.5v5A2.5 2.5 0 0 1 18 18H6A2.5 2.5 0 0 1 3.5 15.5v-7Z" />
  </svg>
);

export const PhoneIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M6.5 4.5h3l1 3-1.8 1.8a13.7 13.7 0 0 0 6 6l1.8-1.8 3 1v3a1.5 1.5 0 0 1-1.5 1.5A15.5 15.5 0 0 1 4.5 6A1.5 1.5 0 0 1 6 4.5Z" />
  </svg>
);

export const ChartUpIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M4 19.5h16" />
    <path d="m6.5 15 4-4 3 3 4.5-5.5" />
    <path d="M18 8.5h-4" />
    <path d="M18 8.5v4" />
  </svg>
);

export const SearchIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);

export const XIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="m6 6 12 12" />
    <path d="M18 6 6 18" />
  </svg>
);

export const SparklesIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="M12 4.5 13.6 9l4.4 1.6-4.4 1.6L12 16.5l-1.6-4.3L6 10.6 10.4 9 12 4.5Z" />
    <path d="M18.5 4.5 19 6l1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z" />
    <path d="M5 15.5 5.5 17l1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z" />
  </svg>
);

export const AlertTriangleIcon: React.FC<IconProps> = ({ className = '' }) => (
  <svg {...baseProps} className={className}>
    <path d="m12 4 8 14H4l8-14Z" />
    <path d="M12 9v4" />
    <path d="M12 16.5h.01" />
  </svg>
);

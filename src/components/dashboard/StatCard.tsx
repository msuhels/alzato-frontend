import React from 'react';
import { LucideProps, ArrowUp, ArrowDown } from 'lucide-react';

interface StatCardProps {
  icon: React.ElementType<LucideProps>;
  title: string;
  value: string;
  change: string;
  changeType: 'increase' | 'decrease';
  subText?: string;
  showChange?: boolean;
  size?: 'sm' | 'md';
}

const StatCard = ({ icon: Icon, title, value, change, changeType, subText, showChange = true, size = 'md' }: StatCardProps) => {
  const isIncrease = changeType === 'increase';
  const changeColor = isIncrease ? 'text-green-600' : 'text-red-600';
  const ChangeIcon = isIncrease ? ArrowUp : ArrowDown;
  const isSmall = size === 'sm';

  return (
    <div className={`h-full min-w-0 ${isSmall ? 'min-h-[100px]' : 'min-h-[120px]'} overflow-hidden rounded-xl bg-white/90 backdrop-blur shadow-sm ring-1 ring-gray-200 hover:shadow-md transition-shadow ${isSmall ? 'p-3' : 'p-5'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-gray-custom-500">{title}</p>
          <p className={`mt-1 font-bold text-gray-custom-900 ${isSmall ? 'text-2xl' : 'text-3xl'}`}>{value}</p>
          {subText ? (
            <p className="text-xs text-gray-custom-500 mt-1">{subText}</p>
          ) : null}
        </div>
        <div className={`shrink-0 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 ${isSmall ? 'p-2' : 'p-2.5'}`}>
          <Icon className={`text-primary ${isSmall ? 'h-4 w-4' : 'h-5 w-5'}`} />
        </div>
      </div>
      {showChange && change ? (
        <div className={`mt-3 flex items-center gap-2 ${isSmall ? 'text-xs' : 'text-sm'}`}>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${isIncrease ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            <ChangeIcon size={12} className={changeColor} />
            {change}
          </span>
          <span className="text-gray-custom-500">vs last month</span>
        </div>
      ) : null}
    </div>
  );
};

export default StatCard;

import React from 'react';
import { LucideProps, ArrowUp, ArrowDown } from 'lucide-react';

interface StatCardProps {
  icon: React.ElementType<LucideProps>;
  title: string;
  value: string;
  change: string;
  changeType: 'increase' | 'decrease';
}

const StatCard = ({ icon: Icon, title, value, change, changeType }: StatCardProps) => {
  const isIncrease = changeType === 'increase';
  const changeColor = isIncrease ? 'text-green-600' : 'text-red-600';
  const ChangeIcon = isIncrease ? ArrowUp : ArrowDown;

  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-custom-500">{title}</p>
        <div className="rounded-full bg-primary-light p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
      <div className="mt-2">
        <p className="text-3xl font-bold text-gray-custom-900">{value}</p>
        <div className="mt-1 flex items-center gap-1 text-sm">
          <ChangeIcon size={14} className={changeColor} />
          <span className={changeColor}>{change}</span>
          <span className="text-gray-custom-500">vs last month</span>
        </div>
      </div>
    </div>
  );
};

export default StatCard;

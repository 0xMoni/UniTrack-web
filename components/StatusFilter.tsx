'use client';

import { StatusFilter as StatusFilterType } from '@/lib/types';
import { getStatusColor } from '@/lib/utils';

interface StatusFilterProps {
  activeFilter: StatusFilterType;
  onFilterChange: (filter: StatusFilterType) => void;
  counts: { safe: number; critical: number; low: number; no_data: number };
}

const filters: { key: StatusFilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'safe', label: 'Safe' },
  { key: 'critical', label: 'Critical' },
  { key: 'low', label: 'Low' },
  { key: 'no_data', label: 'No Data' },
];

export default function StatusFilter({ activeFilter, onFilterChange, counts }: StatusFilterProps) {
  const getCount = (key: StatusFilterType): number => {
    if (key === 'all') return counts.safe + counts.critical + counts.low + counts.no_data;
    return counts[key];
  };

  return (
    <div className="flex flex-wrap gap-2">
      {filters.filter(({ key }) => key !== 'no_data' || counts.no_data > 0).map(({ key, label }) => {
        const isActive = activeFilter === key;
        const count = getCount(key);

        return (
          <button
            key={key}
            onClick={() => onFilterChange(key)}
            className={`
              flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all
              ${isActive
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/50'
              }
            `}
          >
            {key !== 'all' && (
              <span className={`w-2 h-2 rounded-full ${getStatusColor(key)}`} />
            )}
            <span>{label}</span>
            <span className={`
              text-xs px-1.5 py-0.5 rounded-md tabular-nums
              ${isActive
                ? 'bg-white/20 dark:bg-slate-900/20'
                : 'bg-slate-200 dark:bg-slate-700/50'
              }
            `}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

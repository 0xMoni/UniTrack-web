'use client';

import { StatusFilter as StatusFilterType } from '@/lib/types';
import { getStatusColor } from '@/lib/utils';

interface StatusCount {
  safe: number;
  critical: number;
  low: number;
}

interface StatusFilterProps {
  activeFilter: StatusFilterType;
  onFilterChange: (filter: StatusFilterType) => void;
  counts: StatusCount;
}

const filters: { key: StatusFilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'safe', label: 'Safe' },
  { key: 'critical', label: 'Critical' },
  { key: 'low', label: 'Low' },
];

export default function StatusFilter({ activeFilter, onFilterChange, counts }: StatusFilterProps) {
  const getCount = (key: StatusFilterType): number => {
    if (key === 'all') return counts.safe + counts.critical + counts.low;
    return counts[key];
  };

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map(({ key, label }) => {
        const isActive = activeFilter === key;
        const count = getCount(key);

        return (
          <button
            key={key}
            onClick={() => onFilterChange(key)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all
              ${isActive
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-lg'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }
            `}
          >
            {key !== 'all' && (
              <span className={`w-2 h-2 rounded-full ${getStatusColor(key)}`} />
            )}
            <span>{label}</span>
            <span className={`
              text-sm px-2 py-0.5 rounded-lg
              ${isActive
                ? 'bg-white/20 dark:bg-gray-900/20'
                : 'bg-gray-200 dark:bg-gray-700'
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

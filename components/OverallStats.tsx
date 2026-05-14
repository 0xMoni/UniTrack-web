'use client';

import { Subject, StatusFilter } from '@/lib/types';
import { calculateClassesToBunk, calculateClassesToAttend, calculateStatus, getEffectiveThreshold } from '@/lib/utils';

interface OverallStatsProps {
  subjects: Subject[];
  globalThreshold: number;
  subjectThresholds: Record<string, number>;
  activeFilter?: StatusFilter;
  onFilterChange?: (filter: StatusFilter) => void;
}

export default function OverallStats({ subjects, globalThreshold, subjectThresholds, activeFilter, onFilterChange }: OverallStatsProps) {
  // Exclude subjects with no classes conducted from aggregate calculations
  const activeSubjects = subjects.filter(s => s.total > 0);

  const totalAttended = activeSubjects.reduce((sum, s) => sum + s.attended, 0);
  const totalClasses = activeSubjects.reduce((sum, s) => sum + s.total, 0);
  const overallPercentage = totalClasses > 0
    ? Math.round((totalAttended / totalClasses) * 1000) / 10
    : 0;

  // Overall projections
  const totalActiveSubjects = activeSubjects.length;
  const afterAttendAll = totalClasses > 0
    ? Math.round(((totalAttended + totalActiveSubjects) / (totalClasses + totalActiveSubjects)) * 1000) / 10
    : 0;
  const afterSkipAll = totalClasses > 0
    ? Math.round((totalAttended / (totalClasses + totalActiveSubjects)) * 1000) / 10
    : 0;

  // Recalculate statuses using per-subject thresholds
  const statuses = subjects.map(s => {
    const t = getEffectiveThreshold(s, globalThreshold, subjectThresholds);
    return calculateStatus(s.percentage, t, s.total);
  });

  const safeCount = statuses.filter(s => s === 'safe').length;
  const criticalCount = statuses.filter(s => s === 'critical').length;
  const lowCount = statuses.filter(s => s === 'low').length;

  const totalBunkable = subjects
    .filter((_, i) => statuses[i] === 'safe')
    .reduce((sum, s) => {
      const t = getEffectiveThreshold(s, globalThreshold, subjectThresholds);
      return sum + calculateClassesToBunk(s.attended, s.total, t);
    }, 0);

  const totalNeeded = subjects
    .filter((_, i) => statuses[i] === 'low')
    .reduce((sum, s) => {
      const t = getEffectiveThreshold(s, globalThreshold, subjectThresholds);
      return sum + calculateClassesToAttend(s.attended, s.total, t);
    }, 0);

  // Use a weighted average threshold for overall comparison (active subjects only)
  const avgThreshold = activeSubjects.length > 0
    ? activeSubjects.reduce((sum, s) => sum + getEffectiveThreshold(s, globalThreshold, subjectThresholds), 0) / activeSubjects.length
    : globalThreshold;

  const isOverallSafe = overallPercentage >= avgThreshold + 5;
  const isOverallCritical = overallPercentage >= avgThreshold;

  const stats: { label: string; value: string | number; sub: string; color: string; ring: string; filter: StatusFilter }[] = [
    {
      label: 'Overall',
      value: `${overallPercentage}%`,
      sub: `${totalAttended}/${totalClasses}`,
      color: isOverallSafe ? 'text-emerald-500' : isOverallCritical ? 'text-amber-500' : 'text-red-500',
      ring: isOverallSafe ? 'ring-emerald-500/20' : isOverallCritical ? 'ring-amber-500/20' : 'ring-red-500/20',
      filter: 'all',
    },
    {
      label: 'Safe',
      value: safeCount,
      sub: `of ${activeSubjects.length}`,
      color: 'text-emerald-500',
      ring: 'ring-emerald-500/20',
      filter: 'safe',
    },
    {
      label: 'Can Bunk',
      value: totalBunkable,
      sub: 'classes total',
      color: 'text-indigo-500',
      ring: 'ring-indigo-500/20',
      filter: 'safe',
    },
    {
      label: lowCount > 0 ? 'Must Attend' : 'At Risk',
      value: totalNeeded > 0 ? totalNeeded : criticalCount,
      sub: totalNeeded > 0 ? 'classes total' : 'subjects',
      color: totalNeeded > 0 ? 'text-red-500' : criticalCount > 0 ? 'text-amber-500' : 'text-emerald-500',
      ring: totalNeeded > 0 ? 'ring-red-500/20' : criticalCount > 0 ? 'ring-amber-500/20' : 'ring-emerald-500/20',
      filter: totalNeeded > 0 ? 'low' : 'critical',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat, index) => {
          const isActive = activeFilter !== undefined && activeFilter === stat.filter && stat.filter !== 'all'
            && (index === stats.findIndex(s => s.filter === activeFilter));
          const isClickable = !!onFilterChange;
          return (
            <button
              key={stat.label}
              onClick={() => onFilterChange?.(activeFilter === stat.filter ? 'all' : stat.filter)}
              className={`text-left bg-white dark:bg-slate-800/50 rounded-2xl p-4 border ring-1 transition-all ${
                isActive
                  ? 'border-slate-900 dark:border-white/30 ring-slate-900/30 dark:ring-white/20 scale-[1.02]'
                  : `border-slate-100 dark:border-slate-700/50 ${stat.ring}`
              } ${isClickable ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''} card-hover`}
            >
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1.5 tabular-nums ${stat.color}`}>{stat.value}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{stat.sub}</p>
            </button>
          );
        })}
      </div>

      {/* Overall projection */}
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-700/50">
        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Next Day Projection</p>
        <div className="grid grid-cols-3 gap-0">
          <div className="text-center">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Current</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{overallPercentage}%</p>
          </div>
          <div className="text-center border-x border-slate-100 dark:border-slate-700">
            <p className="text-xs text-emerald-500 mb-1">Attend all</p>
            <p className="text-2xl font-bold text-emerald-500 tabular-nums">{afterAttendAll}%</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-red-400 mb-1">Skip all</p>
            <p className="text-2xl font-bold text-red-400 tabular-nums">{afterSkipAll}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}

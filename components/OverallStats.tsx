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
  const totalAttended = subjects.reduce((sum, s) => sum + s.attended, 0);
  const totalClasses = subjects.reduce((sum, s) => sum + s.total, 0);
  const overallPercentage = totalClasses > 0
    ? Math.round((totalAttended / totalClasses) * 1000) / 10
    : 0;

  // Overall projections
  const totalSubjects = subjects.length;
  const afterAttendAll = totalClasses > 0
    ? Math.round(((totalAttended + totalSubjects) / (totalClasses + totalSubjects)) * 1000) / 10
    : 0;
  const afterSkipAll = totalClasses > 0
    ? Math.round((totalAttended / (totalClasses + totalSubjects)) * 1000) / 10
    : 0;

  // Recalculate statuses using per-subject thresholds
  const statuses = subjects.map(s => {
    const t = getEffectiveThreshold(s, globalThreshold, subjectThresholds);
    return calculateStatus(s.percentage, t);
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

  // Use a weighted average threshold for overall comparison
  const avgThreshold = subjects.length > 0
    ? subjects.reduce((sum, s) => sum + getEffectiveThreshold(s, globalThreshold, subjectThresholds), 0) / subjects.length
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
      sub: `of ${subjects.length}`,
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
        {stats.map((stat) => {
          const isActive = activeFilter !== undefined && activeFilter === stat.filter && stat.filter !== 'all';
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

      {/* Overall projection bar */}
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Overall projection</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Next full day ({totalSubjects} classes)
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-500 dark:text-slate-400">Now <span className="font-bold text-slate-900 dark:text-white">{overallPercentage}%</span></span>
          <span className="text-emerald-500 font-medium">attend all → {afterAttendAll}%</span>
          <span className="text-red-400 font-medium">skip all → {afterSkipAll}%</span>
        </div>
      </div>
    </div>
  );
}

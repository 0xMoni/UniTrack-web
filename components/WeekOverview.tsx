'use client';

import { useState } from 'react';
import { Subject, Timetable } from '@/lib/types';
import { calculateStatus, getEffectiveThreshold, getStatusColor, getSubjectKey, getStatusTextColor } from '@/lib/utils';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface WeekOverviewProps {
  timetable: Timetable;
  subjects: Subject[];
  globalThreshold: number;
  subjectThresholds: Record<string, number>;
}

export default function WeekOverview({ timetable, subjects, globalThreshold, subjectThresholds }: WeekOverviewProps) {
  const subjectMap = new Map(subjects.map(s => [getSubjectKey(s), s]));
  const jsDay = new Date().getDay();
  const todayIndex = jsDay === 0 ? -1 : jsDay - 1;
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50">
      <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Week at a glance</p>
      <div className="flex gap-2 overflow-x-auto">
        {DAY_NAMES.map((name, i) => {
          const codes = timetable[i] || [];
          const isToday = i === todayIndex;
          const daySubjects = codes
            .map(c => subjectMap.get(c))
            .filter((s): s is Subject => !!s);

          return (
            <button
              key={name}
              onClick={() => setExpandedDay(expandedDay === i ? null : i)}
              className={`flex-1 min-w-[52px] rounded-xl p-2.5 text-center transition-all cursor-pointer ${
                isToday
                  ? 'bg-indigo-500/10 border border-indigo-500/20 ring-1 ring-indigo-500/20'
                  : expandedDay === i
                    ? 'bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600'
                    : 'border border-transparent hover:bg-slate-50 dark:hover:bg-slate-700/20'
              }`}
            >
              <p className={`text-[11px] font-semibold mb-2 ${
                isToday ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-500'
              }`}>
                {name}
              </p>
              <div className="flex flex-wrap justify-center gap-1">
                {daySubjects.length > 0 ? (
                  daySubjects.map((s, j) => {
                    const t = getEffectiveThreshold(s, globalThreshold, subjectThresholds);
                    const status = calculateStatus(s.percentage, t, s.total);
                    return (
                      <div
                        key={`${getSubjectKey(s)}-${j}`}
                        className={`w-2.5 h-2.5 rounded-full ${getStatusColor(status)}`}
                      />
                    );
                  })
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Expanded day details */}
      {expandedDay !== null && (() => {
        const codes = timetable[expandedDay] || [];
        const daySubjects = codes
          .map(c => subjectMap.get(c))
          .filter((s): s is Subject => !!s);

        if (daySubjects.length === 0) return (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center">No classes on {DAY_NAMES[expandedDay]}</p>
          </div>
        );

        return (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              {DAY_NAMES[expandedDay]} — {daySubjects.length} classes
            </p>
            {daySubjects.map((s, j) => {
              const t = getEffectiveThreshold(s, globalThreshold, subjectThresholds);
              const status = calculateStatus(s.percentage, t, s.total);
              return (
                <div key={`${getSubjectKey(s)}-${j}`} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(status)}`} />
                    <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{s.name}</span>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ml-3 ${getStatusTextColor(status)}`}>
                    {s.percentage.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

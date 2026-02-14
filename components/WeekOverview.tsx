'use client';

import { Subject, Timetable } from '@/lib/types';
import { calculateStatus, getEffectiveThreshold, getStatusColor, getSubjectKey } from '@/lib/utils';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface WeekOverviewProps {
  timetable: Timetable;
  subjects: Subject[];
  globalThreshold: number;
  subjectThresholds: Record<string, number>;
}

export default function WeekOverview({ timetable, subjects, globalThreshold, subjectThresholds }: WeekOverviewProps) {
  const subjectMap = new Map(subjects.map(s => [getSubjectKey(s), s]));
  const jsDay = new Date().getDay(); // 0=Sun
  const todayIndex = jsDay === 0 ? -1 : jsDay - 1; // -1 means Sunday (not in grid)

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
            <div
              key={name}
              className={`flex-1 min-w-[52px] rounded-xl p-2.5 text-center transition-all ${
                isToday
                  ? 'bg-indigo-500/10 border border-indigo-500/20 ring-1 ring-indigo-500/20'
                  : 'border border-transparent'
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
                    const status = calculateStatus(s.percentage, t);
                    return (
                      <div
                        key={`${getSubjectKey(s)}-${j}`}
                        className={`w-2.5 h-2.5 rounded-full ${getStatusColor(status)}`}
                        title={`${s.name} — ${s.percentage.toFixed(1)}%`}
                      />
                    );
                  })
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700" title="No classes" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

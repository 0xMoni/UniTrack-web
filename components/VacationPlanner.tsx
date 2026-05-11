'use client';

import { useState, useMemo } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';
import { Subject, Timetable } from '@/lib/types';
import { getSubjectKey, getEffectiveThreshold } from '@/lib/utils';
import {
  getVacationDays,
  calculateVacationImpact,
  findBestVacationWindows,
  VacationWindow,
} from '@/lib/vacationPlanner';

interface VacationPlannerProps {
  subjects: Subject[];
  timetable: Timetable;
  globalThreshold: number;
  subjectThresholds: Record<string, number>;
}

export default function VacationPlanner({
  subjects, timetable, globalThreshold, subjectThresholds,
}: VacationPlannerProps) {
  const [range, setRange] = useState<DateRange | undefined>();
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [showSuggestions, setShowSuggestions] = useState(false);

  const subjectMap = useMemo(
    () => new Map(subjects.map(s => [getSubjectKey(s), s])),
    [subjects]
  );

  const hasTimetable = Object.values(timetable).some(codes => codes.length > 0);

  const impact = useMemo(() => {
    if (!range?.from || !range?.to) return null;
    const days = getVacationDays(range.from, range.to, holidays);
    return calculateVacationImpact(days, timetable, subjectMap, globalThreshold, subjectThresholds);
  }, [range, holidays, timetable, subjectMap, globalThreshold, subjectThresholds]);

  const suggestions = useMemo(() => {
    if (!showSuggestions) return [];
    return findBestVacationWindows(timetable, subjectMap, globalThreshold, subjectThresholds);
  }, [showSuggestions, timetable, subjectMap, globalThreshold, subjectThresholds]);

  if (!hasTimetable) {
    return (
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-700/50">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-2">Vacation Planner</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Set up your timetable first to use the vacation planner.</p>
      </div>
    );
  }

  const toggleHoliday = (dateStr: string) => {
    setHolidays(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  const applySuggestion = (window: VacationWindow) => {
    setRange({ from: window.startDate, to: window.endDate });
    setShowSuggestions(false);
  };

  const formatDate = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Vacation Planner</h2>
        <button
          onClick={() => setShowSuggestions(!showSuggestions)}
          className="text-xs font-medium text-indigo-500 hover:text-indigo-600 transition-colors"
        >
          {showSuggestions ? 'Hide suggestions' : 'Find best windows'}
        </button>
      </div>

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3 mb-5">
          {suggestions.map((w, i) => (
            <button
              key={i}
              onClick={() => applySuggestion(w)}
              className="text-left p-3 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-sm transition-all"
            >
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {formatDate(w.startDate)} – {formatDate(w.endDate)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {w.duration} days · {w.totalClasses} classes · {w.atRiskCount === 0 ? (
                  <span className="text-green-600 dark:text-green-400">No risk</span>
                ) : (
                  <span className="text-red-500">{w.atRiskCount} at risk</span>
                )}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Calendar */}
      <div className="flex flex-col lg:flex-row gap-5">
        <div className="rdp-wrapper">
          <DayPicker
            mode="range"
            selected={range}
            onSelect={setRange}
            numberOfMonths={1}
            disabled={{ before: new Date() }}
            classNames={{
              root: 'text-sm',
              day: 'rounded-lg',
              selected: 'bg-indigo-500 text-white',
              range_middle: 'bg-indigo-100 dark:bg-indigo-900/30',
              today: 'font-bold text-indigo-600 dark:text-indigo-400',
            }}
          />
        </div>

        {/* Impact results */}
        {impact && (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-4 mb-4 text-sm">
              <span className="text-slate-500 dark:text-slate-400">
                {impact.totalDays} days · {impact.activeDays} active · {impact.totalClasses} classes
              </span>
            </div>

            {/* Holiday toggles for active days */}
            {range?.from && range?.to && (
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Mark holidays (no classes):</p>
                <div className="flex flex-wrap gap-1.5">
                  {getVacationDays(range.from, range.to, new Set()).filter(d => !d.isSunday).map(d => (
                    <button
                      key={d.dateStr}
                      onClick={() => toggleHoliday(d.dateStr)}
                      className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                        holidays.has(d.dateStr)
                          ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400'
                          : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-amber-300'
                      }`}
                    >
                      {d.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Impact table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                    <th className="text-left py-2 pr-3 font-medium">Subject</th>
                    <th className="text-right py-2 px-2 font-medium">Miss</th>
                    <th className="text-right py-2 px-2 font-medium">Now</th>
                    <th className="text-right py-2 px-2 font-medium">After</th>
                    <th className="text-right py-2 pl-2 font-medium">Drop</th>
                  </tr>
                </thead>
                <tbody>
                  {impact.impacts.map((item) => (
                    <tr
                      key={item.code}
                      className={`border-b border-slate-50 dark:border-slate-800 ${
                        item.breachesThreshold ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                      }`}
                    >
                      <td className="py-2 pr-3">
                        <span className="text-slate-900 dark:text-white font-medium truncate block max-w-[160px]">
                          {item.name}
                        </span>
                      </td>
                      <td className="text-right py-2 px-2 text-slate-600 dark:text-slate-300">
                        {item.classCount}
                      </td>
                      <td className="text-right py-2 px-2 text-slate-600 dark:text-slate-300">
                        {item.isNoData ? '—' : `${item.currentPct.toFixed(1)}%`}
                      </td>
                      <td className={`text-right py-2 px-2 font-medium ${
                        item.breachesThreshold ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
                      }`}>
                        {item.isNoData ? '—' : `${item.projectedPct.toFixed(1)}%`}
                      </td>
                      <td className="text-right py-2 pl-2 text-red-500">
                        {item.isNoData ? '—' : `-${item.drop.toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {impact.impacts.some(i => i.breachesThreshold) && (
              <p className="mt-3 text-xs text-red-500 dark:text-red-400 font-medium">
                ⚠ Some subjects will fall below threshold during this vacation
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

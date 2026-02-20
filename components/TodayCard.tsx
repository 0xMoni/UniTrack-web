'use client';

import { Subject } from '@/lib/types';
import { calculateClassesToBunk, calculateStatus, getEffectiveThreshold, getSubjectKey } from '@/lib/utils';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface TodayCardProps {
  subjects: Subject[];
  globalThreshold: number;
  subjectThresholds: Record<string, number>;
}

function getVerdict(subject: Subject, threshold: number): 'skip' | 'risky' | 'attend' | 'no_data' {
  const status = calculateStatus(subject.percentage, threshold, subject.total);
  if (status === 'no_data') return 'no_data';
  if (status === 'safe' && calculateClassesToBunk(subject.attended, subject.total, threshold) > 0) {
    return 'skip';
  }
  if (status === 'low') return 'attend';
  return 'risky';
}

const verdictConfig = {
  skip: { label: 'Can skip', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' },
  risky: { label: 'Risky', bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20' },
  attend: { label: 'Must attend', bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/20' },
  no_data: { label: 'No data', bg: 'bg-slate-500/10', text: 'text-slate-500 dark:text-slate-400', border: 'border-slate-500/20' },
};

export default function TodayCard({ subjects, globalThreshold, subjectThresholds }: TodayCardProps) {
  const dayName = DAY_NAMES[new Date().getDay()];

  if (subjects.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{dayName}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">No classes today — enjoy your free time!</p>
          </div>
        </div>
      </div>
    );
  }

  const verdicts = subjects.map(s => {
    const t = getEffectiveThreshold(s, globalThreshold, subjectThresholds);
    return getVerdict(s, t);
  });

  const skipCount = verdicts.filter(v => v === 'skip').length;

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Today &mdash; {dayName}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{subjects.length} class{subjects.length !== 1 ? 'es' : ''}</p>
          </div>
        </div>
      </div>

      {/* Subject rows */}
      <div className="px-5 pb-2 space-y-1.5">
        {subjects.map((subject, i) => {
          const key = getSubjectKey(subject);
          const t = getEffectiveThreshold(subject, globalThreshold, subjectThresholds);
          const status = calculateStatus(subject.percentage, t, subject.total);
          const verdict = verdicts[i];
          const cfg = verdictConfig[verdict];
          const pctColor = status === 'no_data' ? 'text-slate-400' : status === 'safe' ? 'text-emerald-500' : status === 'critical' ? 'text-amber-500' : 'text-red-500';

          return (
            <div
              key={`${key}-${i}`}
              className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{subject.name}</p>
                {subject.code && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{subject.code}</p>
                )}
              </div>
              <span className={`text-sm font-bold tabular-nums ${pctColor}`}>
                {subject.percentage.toFixed(1)}%
              </span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${cfg.bg} ${cfg.text} ${cfg.border} whitespace-nowrap`}>
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700/50">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {skipCount > 0 ? (
            <>You can safely skip <span className="font-bold text-emerald-500">{skipCount} of {subjects.length}</span> class{subjects.length !== 1 ? 'es' : ''} today</>
          ) : (
            <span className="font-medium text-amber-500">Better attend all classes today</span>
          )}
        </p>
      </div>
    </div>
  );
}

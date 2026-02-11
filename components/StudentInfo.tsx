'use client';

import { StudentInfo as StudentInfoType } from '@/lib/types';
import { formatDate } from '@/lib/utils';

interface StudentInfoProps {
  student: StudentInfoType;
  lastUpdated: string;
  onRefresh: () => void;
  isLoading: boolean;
}

export default function StudentInfo({ student, lastUpdated, onRefresh, isLoading }: StudentInfoProps) {
  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-700/50">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {student.name}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-mono text-sm">
            {student.usn}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Last updated: {formatDate(lastUpdated)}
          </p>
          <p className="text-xs font-medium text-indigo-500/70 dark:text-indigo-400/60 pt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Refresh data"
        >
          <svg
            className={`w-4.5 h-4.5 text-slate-500 dark:text-slate-400 ${isLoading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

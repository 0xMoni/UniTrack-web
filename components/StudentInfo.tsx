'use client';

import { StudentInfo as StudentInfoType } from '@/lib/types';
import { formatDate } from '@/lib/utils';

interface StudentInfoProps {
  student: StudentInfoType;
  lastUpdated: string;
}

export default function StudentInfo({ student, lastUpdated }: StudentInfoProps) {
  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-700/50">
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
    </div>
  );
}

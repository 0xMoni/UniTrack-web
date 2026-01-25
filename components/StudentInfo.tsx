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
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {student.name}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 font-mono">
            {student.usn}
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Last updated: {formatDate(lastUpdated)}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Refresh data"
        >
          <svg
            className={`w-5 h-5 text-gray-600 dark:text-gray-300 ${isLoading ? 'animate-spin' : ''}`}
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

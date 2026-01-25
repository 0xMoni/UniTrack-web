'use client';

import { Subject } from '@/lib/types';
import { getStatusBgColor, getStatusTextColor, calculateClassesToBunk, calculateClassesToAttend } from '@/lib/utils';

interface AttendanceCardProps {
  subject: Subject;
  threshold: number;
}

export default function AttendanceCard({ subject, threshold }: AttendanceCardProps) {
  const { name, attended, total, percentage, status } = subject;

  const classesToBunk = calculateClassesToBunk(attended, total, threshold);
  const classesToAttend = calculateClassesToAttend(attended, total, threshold);

  const statusText = {
    safe: `Can miss ${classesToBunk} class${classesToBunk !== 1 ? 'es' : ''}`,
    critical: 'At threshold - attend all classes',
    low: `Attend ${classesToAttend} more class${classesToAttend !== 1 ? 'es' : ''} to reach ${threshold}%`,
  };

  return (
    <div className={`
      relative overflow-hidden rounded-2xl border p-5 transition-all hover:shadow-md
      ${getStatusBgColor(status)}
    `}>
      {/* Progress bar background */}
      <div
        className={`absolute inset-0 opacity-10 ${status === 'safe' ? 'bg-emerald-500' : status === 'critical' ? 'bg-amber-500' : 'bg-red-500'}`}
        style={{ width: `${percentage}%` }}
      />

      <div className="relative space-y-3">
        {/* Subject name and percentage */}
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-semibold text-gray-900 dark:text-white leading-tight">
            {name}
          </h3>
          <span className={`text-2xl font-bold tabular-nums ${getStatusTextColor(status)}`}>
            {percentage.toFixed(1)}%
          </span>
        </div>

        {/* Attendance count */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-300">
            {attended} / {total} classes attended
          </span>
        </div>

        {/* Status message */}
        <div className={`text-sm font-medium ${getStatusTextColor(status)}`}>
          {statusText[status]}
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              status === 'safe' ? 'bg-emerald-500' : status === 'critical' ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>

        {/* Threshold marker */}
        <div className="relative h-0">
          <div
            className="absolute -top-2 w-0.5 h-2 bg-gray-400 dark:bg-gray-500"
            style={{ left: `${threshold}%` }}
          />
        </div>
      </div>
    </div>
  );
}

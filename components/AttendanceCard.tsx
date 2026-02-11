'use client';

import { useState } from 'react';
import { Subject } from '@/lib/types';
import { getStatusBgColor, getStatusTextColor, calculateClassesToBunk, calculateClassesToAttend, calculateStatus } from '@/lib/utils';

interface AttendanceCardProps {
  subject: Subject;
  threshold: number;
  hasCustomThreshold: boolean;
  onThresholdChange: (value: number | null) => void;
}

export default function AttendanceCard({ subject, threshold, hasCustomThreshold, onThresholdChange }: AttendanceCardProps) {
  const [editing, setEditing] = useState(false);
  const { name, code, attended, total, percentage } = subject;

  const status = calculateStatus(percentage, threshold);
  const classesToBunk = calculateClassesToBunk(attended, total, threshold);
  const classesToAttend = calculateClassesToAttend(attended, total, threshold);
  const missed = total - attended;

  // Projections
  const afterAttend = total > 0 ? Math.round(((attended + 1) / (total + 1)) * 1000) / 10 : 0;
  const afterSkip = total > 0 ? Math.round((attended / (total + 1)) * 1000) / 10 : 0;

  return (
    <div className={`
      relative overflow-hidden rounded-2xl border p-5 transition-all card-hover
      ${getStatusBgColor(status)}
    `}>
      {/* Progress bar background */}
      <div
        className={`absolute inset-y-0 left-0 opacity-[0.07] ${
          status === 'safe' ? 'bg-emerald-500' : status === 'critical' ? 'bg-amber-500' : 'bg-red-500'
        }`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />

      <div className="relative space-y-3">
        {/* Subject name and percentage */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white leading-tight">
              {name}
            </h3>
            {code && (
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{code}</span>
            )}
          </div>
          <span className={`text-2xl font-bold tabular-nums whitespace-nowrap ${getStatusTextColor(status)}`}>
            {percentage.toFixed(1)}%
          </span>
        </div>

        {/* Attendance details */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-600 dark:text-slate-300">
            {attended}/{total} attended
          </span>
          <span className="text-slate-400 dark:text-slate-500">
            {missed} missed
          </span>
        </div>

        {/* Status message */}
        <div className={`text-sm font-medium ${getStatusTextColor(status)}`}>
          {status === 'safe' && (
            <span>You can skip {classesToBunk} more class{classesToBunk !== 1 ? 'es' : ''}</span>
          )}
          {status === 'critical' && (
            <span>At threshold — don&apos;t miss any classes</span>
          )}
          {status === 'low' && (
            <span>Attend {classesToAttend} more class{classesToAttend !== 1 ? 'es' : ''} to reach {threshold}%</span>
          )}
        </div>

        {/* Next class projection */}
        <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
          <span>Next class:</span>
          <span className="text-emerald-500 font-medium">attend → {afterAttend}%</span>
          <span className="text-red-400 font-medium">skip → {afterSkip}%</span>
        </div>

        {/* Progress bar + threshold badge */}
        <div className="space-y-1.5">
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden relative">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                status === 'safe' ? 'bg-emerald-500' : status === 'critical' ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
            {/* Threshold marker */}
            <div
              className="absolute top-0 w-0.5 h-full bg-slate-900/30 dark:bg-white/30"
              style={{ left: `${threshold}%` }}
            />
          </div>

          {/* Threshold badge row */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setEditing(!editing)}
              className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md transition-colors ${
                hasCustomThreshold
                  ? 'bg-indigo-500/10 text-indigo-500 font-semibold'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <span>min {threshold}%</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            {hasCustomThreshold && (
              <button
                onClick={() => onThresholdChange(null)}
                className="text-[11px] text-slate-400 hover:text-red-400 transition-colors"
              >
                reset
              </button>
            )}
          </div>
        </div>

        {/* Inline threshold editor */}
        {editing && (
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-3 border border-slate-200 dark:border-slate-600/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Subject threshold</span>
              <span className="text-sm font-bold text-indigo-500 tabular-nums">{threshold}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              step="1"
              value={threshold}
              onChange={(e) => onThresholdChange(Number(e.target.value))}
              className="slider"
            />
          </div>
        )}
      </div>
    </div>
  );
}

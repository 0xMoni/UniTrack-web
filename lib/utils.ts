import { Subject } from './types';

const BUFFER = 5; // Buffer percentage above threshold

export function calculateStatus(
  percentage: number,
  threshold: number,
  total: number = -1
): 'safe' | 'critical' | 'low' | 'no_data' {
  if (total === 0) return 'no_data';
  if (percentage >= threshold + BUFFER) {
    return 'safe';
  } else if (percentage >= threshold) {
    return 'critical';
  }
  return 'low';
}

export function getStatusColor(status: 'safe' | 'critical' | 'low' | 'no_data'): string {
  switch (status) {
    case 'safe':
      return 'bg-emerald-500';
    case 'critical':
      return 'bg-amber-500';
    case 'low':
      return 'bg-red-500';
    case 'no_data':
      return 'bg-slate-400';
  }
}

export function getStatusBgColor(status: 'safe' | 'critical' | 'low' | 'no_data'): string {
  switch (status) {
    case 'safe':
      return 'bg-emerald-500/10 border-emerald-500/20';
    case 'critical':
      return 'bg-amber-500/10 border-amber-500/20';
    case 'low':
      return 'bg-red-500/10 border-red-500/20';
    case 'no_data':
      return 'bg-slate-500/10 border-slate-500/20';
  }
}

export function getStatusTextColor(status: 'safe' | 'critical' | 'low' | 'no_data'): string {
  switch (status) {
    case 'safe':
      return 'text-emerald-500';
    case 'critical':
      return 'text-amber-500';
    case 'low':
      return 'text-red-500';
    case 'no_data':
      return 'text-slate-400';
  }
}

export function calculateClassesToBunk(
  attended: number,
  total: number,
  threshold: number
): number {
  // Classes you can miss while staying above threshold
  // (attended / (total + x)) >= threshold/100
  // attended >= (total + x) * threshold/100
  // attended * 100 / threshold >= total + x
  // x <= (attended * 100 / threshold) - total
  const canBunk = Math.floor((attended * 100) / threshold - total);
  return Math.max(0, canBunk);
}

export function calculateClassesToAttend(
  attended: number,
  total: number,
  threshold: number
): number {
  // Classes needed to reach threshold
  // ((attended + x) / (total + x)) >= threshold/100
  // (attended + x) * 100 >= (total + x) * threshold
  // attended * 100 + x * 100 >= total * threshold + x * threshold
  // x * (100 - threshold) >= total * threshold - attended * 100
  // x >= (total * threshold - attended * 100) / (100 - threshold)
  if (threshold >= 100) return Infinity;
  const needed = Math.ceil(
    (total * threshold - attended * 100) / (100 - threshold)
  );
  return Math.max(0, needed);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const STORAGE_KEY = 'unitrack_data';
export const CREDENTIALS_KEY = 'unitrack_credentials';
export const THRESHOLD_KEY = 'unitrack_threshold';
export const SUBJECT_THRESHOLDS_KEY = 'unitrack_subject_thresholds';
export const ERP_URL_KEY = 'unitrack_erp_url';
export const TIMETABLE_KEY = 'unitrack_timetable';

export function getSubjectKey(subject: Subject): string {
  return subject.code || subject.name;
}

export function getEffectiveThreshold(
  subject: Subject,
  globalThreshold: number,
  subjectThresholds: Record<string, number>
): number {
  const key = getSubjectKey(subject);
  return subjectThresholds[key] ?? globalThreshold;
}

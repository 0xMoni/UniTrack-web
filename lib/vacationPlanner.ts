import { Subject, Timetable } from './types';
import { calculateClassesToBunk, getEffectiveThreshold } from './utils';

export interface SubjectImpact {
  code: string;
  name: string;
  classCount: number;
  currentPct: number;
  projectedPct: number;
  drop: number;
  currentBunkable: number;
  projectedBunkable: number;
  breachesThreshold: boolean;
  isNoData: boolean;
}

export interface VacationDay {
  date: Date;
  dateStr: string;
  jsDay: number;
  timetableDayIndex: number;
  isSunday: boolean;
  isHoliday: boolean;
}

export interface VacationImpactResult {
  impacts: SubjectImpact[];
  totalClasses: number;
  activeDays: number;
  totalDays: number;
}

export interface VacationWindow {
  startDate: Date;
  endDate: Date;
  duration: number;
  totalClasses: number;
  atRiskCount: number;
  penalty: number;
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getVacationDays(
  startDate: Date,
  endDate: Date,
  holidays: Set<string>,
): VacationDay[] {
  const days: VacationDay[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const jsDay = current.getDay();
    const dateStr = formatDateStr(current);
    days.push({
      date: new Date(current),
      dateStr,
      jsDay,
      timetableDayIndex: jsDay === 0 ? -1 : jsDay - 1,
      isSunday: jsDay === 0,
      isHoliday: holidays.has(dateStr),
    });
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function countClassesBetween(
  fromDate: Date,
  toDate: Date,
  timetable: Timetable,
): Record<string, number> {
  const counts: Record<string, number> = {};
  const current = new Date(fromDate);
  current.setHours(0, 0, 0, 0);
  current.setDate(current.getDate() + 1);
  const end = new Date(toDate);
  end.setHours(0, 0, 0, 0);

  while (current < end) {
    const jsDay = current.getDay();
    if (jsDay !== 0) {
      const timetableDayIndex = jsDay - 1;
      const codes = timetable[timetableDayIndex] ?? [];
      for (const code of codes) {
        counts[code] = (counts[code] || 0) + 1;
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return counts;
}

export function calculateVacationImpact(
  vacationDays: VacationDay[],
  timetable: Timetable,
  subjectMap: Map<string, Subject>,
  globalThreshold: number,
  subjectThresholds: Record<string, number>,
): VacationImpactResult {
  const codeCount: Record<string, number> = {};
  let totalClasses = 0;
  let activeDays = 0;

  for (const day of vacationDays) {
    if (day.isSunday || day.isHoliday) continue;
    const codes = timetable[day.timetableDayIndex] ?? [];
    if (codes.length === 0) continue;
    activeDays++;
    totalClasses += codes.length;
    for (const code of codes) {
      codeCount[code] = (codeCount[code] || 0) + 1;
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const vacationStart = vacationDays.length > 0 ? vacationDays[0].date : today;
  const preVacationClasses = vacationStart > today
    ? countClassesBetween(today, vacationStart, timetable)
    : {};

  const impacts: SubjectImpact[] = [];

  for (const [code, count] of Object.entries(codeCount)) {
    const subject = subjectMap.get(code);
    if (!subject) continue;

    const threshold = getEffectiveThreshold(subject, globalThreshold, subjectThresholds);
    const isNoData = subject.total === 0;

    if (isNoData) {
      impacts.push({
        code,
        name: subject.name,
        classCount: count,
        currentPct: 0,
        projectedPct: 0,
        drop: 0,
        currentBunkable: 0,
        projectedBunkable: 0,
        breachesThreshold: false,
        isNoData: true,
      });
      continue;
    }

    const preClasses = preVacationClasses[code] || 0;
    const adjustedAttended = subject.attended + preClasses;
    const adjustedTotal = subject.total + preClasses;

    const currentPct = (adjustedAttended / adjustedTotal) * 100;
    const projectedPct = (adjustedAttended / (adjustedTotal + count)) * 100;
    const drop = currentPct - projectedPct;
    const currentBunkable = calculateClassesToBunk(adjustedAttended, adjustedTotal, threshold);
    const projectedBunkable = calculateClassesToBunk(adjustedAttended, adjustedTotal + count, threshold);
    const breachesThreshold = projectedPct < threshold;

    impacts.push({
      code,
      name: subject.name,
      classCount: count,
      currentPct,
      projectedPct,
      drop,
      currentBunkable,
      projectedBunkable,
      breachesThreshold,
      isNoData: false,
    });
  }

  impacts.sort((a, b) => {
    if (a.isNoData !== b.isNoData) return a.isNoData ? 1 : -1;
    if (a.breachesThreshold !== b.breachesThreshold) return a.breachesThreshold ? -1 : 1;
    return b.drop - a.drop;
  });

  return { impacts, totalClasses, activeDays, totalDays: vacationDays.length };
}

export function findBestVacationWindows(
  timetable: Timetable,
  subjectMap: Map<string, Subject>,
  globalThreshold: number,
  subjectThresholds: Record<string, number>,
  windowSizes: number[] = [3, 5, 7],
  weeksAhead: number = 3,
): VacationWindow[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endScan = new Date(today);
  endScan.setDate(endScan.getDate() + weeksAhead * 7);

  const candidates: VacationWindow[] = [];
  const emptyHolidays = new Set<string>();

  for (const size of windowSizes) {
    const current = new Date(today);
    current.setDate(current.getDate() + 1);

    while (true) {
      const windowEnd = new Date(current);
      windowEnd.setDate(windowEnd.getDate() + size - 1);
      if (windowEnd > endScan) break;

      const days = getVacationDays(current, windowEnd, emptyHolidays);
      const result = calculateVacationImpact(
        days, timetable, subjectMap, globalThreshold, subjectThresholds,
      );

      let penalty = 0;
      for (const impact of result.impacts) {
        if (impact.isNoData) continue;
        const subject = subjectMap.get(impact.code);
        if (!subject) continue;
        const threshold = getEffectiveThreshold(
          subject, globalThreshold, subjectThresholds,
        );
        const margin = impact.currentPct - threshold;
        let weight: number;
        if (margin < 0) weight = 3;
        else if (margin < 5) weight = 2;
        else weight = 1;
        penalty += impact.drop * weight * impact.classCount;
      }

      const atRiskCount = result.impacts.filter(i => i.breachesThreshold && !i.isNoData).length;

      candidates.push({
        startDate: new Date(current),
        endDate: windowEnd,
        duration: size,
        totalClasses: result.totalClasses,
        atRiskCount,
        penalty,
      });

      current.setDate(current.getDate() + 1);
    }
  }

  candidates.sort((a, b) => a.penalty - b.penalty);

  const results: VacationWindow[] = [];
  for (const c of candidates) {
    const overlaps = results.some(r => c.startDate <= r.endDate && c.endDate >= r.startDate);
    if (!overlaps) {
      results.push(c);
      if (results.length >= 3) break;
    }
  }

  return results;
}

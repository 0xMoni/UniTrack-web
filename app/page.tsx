'use client';

import { useState, useEffect, useCallback } from 'react';
import LoginForm from '@/components/LoginForm';
import StudentInfo from '@/components/StudentInfo';
import StatusFilter from '@/components/StatusFilter';
import AttendanceCard from '@/components/AttendanceCard';
import ThresholdModal from '@/components/ThresholdModal';
import TimetableSetup from '@/components/TimetableSetup';
import TodayCard from '@/components/TodayCard';
import WeekOverview from '@/components/WeekOverview';
import OverallStats from '@/components/OverallStats';
import ThemeToggle from '@/components/ThemeToggle';
import { useTheme } from '@/lib/useTheme';
import { AttendanceData, StatusFilter as StatusFilterType, FetchResponse, Timetable } from '@/lib/types';
import { STORAGE_KEY, CREDENTIALS_KEY, THRESHOLD_KEY, SUBJECT_THRESHOLDS_KEY, ERP_URL_KEY, TIMETABLE_KEY, calculateStatus, getSubjectKey, getEffectiveThreshold } from '@/lib/utils';

export default function Home() {
  const { dark, toggle: toggleTheme, mounted } = useTheme();
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<StatusFilterType>('all');
  const [savedUsername, setSavedUsername] = useState('');
  const [savedErpUrl, setSavedErpUrl] = useState('');
  const [sessionPassword, setSessionPassword] = useState('');
  const [threshold, setThreshold] = useState(75);
  const [subjectThresholds, setSubjectThresholds] = useState<Record<string, number>>({});
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [timetable, setTimetable] = useState<Timetable>({});
  const [showTimetableSetup, setShowTimetableSetup] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load data from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        try {
          setAttendanceData(JSON.parse(savedData));
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      const savedCreds = localStorage.getItem(CREDENTIALS_KEY);
      if (savedCreds) {
        try {
          const creds = JSON.parse(savedCreds);
          setSavedUsername(creds.username || '');
        } catch {
          localStorage.removeItem(CREDENTIALS_KEY);
        }
      }

      const storedErpUrl = localStorage.getItem(ERP_URL_KEY);
      if (storedErpUrl) {
        setSavedErpUrl(storedErpUrl);
      }

      const savedThreshold = localStorage.getItem(THRESHOLD_KEY);
      if (savedThreshold) {
        setThreshold(parseInt(savedThreshold) || 75);
      }

      const savedSubjectThresholds = localStorage.getItem(SUBJECT_THRESHOLDS_KEY);
      if (savedSubjectThresholds) {
        try {
          setSubjectThresholds(JSON.parse(savedSubjectThresholds));
        } catch {
          localStorage.removeItem(SUBJECT_THRESHOLDS_KEY);
        }
      }

      const savedTimetable = localStorage.getItem(TIMETABLE_KEY);
      if (savedTimetable) {
        try {
          setTimetable(JSON.parse(savedTimetable));
        } catch {
          localStorage.removeItem(TIMETABLE_KEY);
        }
      }

      setIsInitialized(true);
    }
  }, []);

  // Save data to localStorage when it changes
  useEffect(() => {
    if (isInitialized && attendanceData) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(attendanceData));
    }
  }, [attendanceData, isInitialized]);

  // Save threshold to localStorage when it changes
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(THRESHOLD_KEY, threshold.toString());
    }
  }, [threshold, isInitialized]);

  // Save subject thresholds to localStorage when they change
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(SUBJECT_THRESHOLDS_KEY, JSON.stringify(subjectThresholds));
    }
  }, [subjectThresholds, isInitialized]);

  // Save timetable to localStorage when it changes
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(TIMETABLE_KEY, JSON.stringify(timetable));
    }
  }, [timetable, isInitialized]);

  const fetchAttendance = useCallback(async (erpUrl: string, username: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ erpUrl, username, password, threshold }),
      });

      const result: FetchResponse = await response.json();

      if (result.success && result.data) {
        setAttendanceData(result.data);
        localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ username }));
        localStorage.setItem(ERP_URL_KEY, erpUrl);
        setSavedUsername(username);
        setSavedErpUrl(erpUrl);
        setSessionPassword(password);
      } else {
        setError(result.error || 'Failed to fetch attendance data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error — check your connection');
    } finally {
      setIsLoading(false);
    }
  }, [threshold]);

  const handleRefresh = () => {
    if (savedErpUrl && savedUsername && sessionPassword) {
      fetchAttendance(savedErpUrl, savedUsername, sessionPassword);
    } else {
      // No password in memory (page was reloaded) — need to log in again
      handleLogout();
    }
  };

  const handleLogout = () => {
    setAttendanceData(null);
    setSessionPassword('');
    localStorage.removeItem(STORAGE_KEY);
    setActiveFilter('all');
  };

  const handleThresholdSave = (newThreshold: number) => {
    setThreshold(newThreshold);
  };

  const handleSubjectThresholdChange = (subjectKey: string, value: number | null) => {
    setSubjectThresholds(prev => {
      const next = { ...prev };
      if (value === null) {
        delete next[subjectKey];
      } else {
        next[subjectKey] = value;
      }
      return next;
    });
  };

  // Compute statuses based on per-subject thresholds
  const getSubjectStatus = (subject: AttendanceData['subjects'][number]) => {
    const t = getEffectiveThreshold(subject, threshold, subjectThresholds);
    return calculateStatus(subject.percentage, t);
  };

  // Show loading state until client is initialized
  if (!mounted || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <img src="/logo.png" alt="UniTrack" className="w-14 h-14 animate-pulse" />
      </div>
    );
  }

  // Show login form if no data
  if (!attendanceData) {
    return (
      <>
        <LoginForm
          onSubmit={fetchAttendance}
          isLoading={isLoading}
          savedUsername={savedUsername}
          savedErpUrl={savedErpUrl}
          dark={dark}
          onToggleTheme={toggleTheme}
        />
        {error && (
          <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-red-500 text-white p-4 rounded-2xl shadow-lg z-50">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium text-sm">Error</p>
                <p className="text-sm opacity-90">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="ml-auto">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Compute status counts using per-subject thresholds
  const statusCounts = attendanceData.subjects.reduce(
    (acc, subject) => {
      const status = getSubjectStatus(subject);
      acc[status]++;
      return acc;
    },
    { safe: 0, critical: 0, low: 0 }
  );

  const filteredSubjects = activeFilter === 'all'
    ? attendanceData.subjects
    : attendanceData.subjects.filter(s => getSubjectStatus(s) === activeFilter);

  const customCount = Object.keys(subjectThresholds).length;

  // Timetable: compute today's subjects
  const hasTimetable = Object.values(timetable).some(codes => codes.length > 0);
  const jsDay = new Date().getDay(); // 0=Sun,1=Mon..6=Sat
  const timetableDayIndex = jsDay === 0 ? -1 : jsDay - 1; // Mon=0..Sat=5, Sun=-1
  const todayCodes = timetableDayIndex >= 0 ? (timetable[timetableDayIndex] || []) : [];
  const subjectMap = new Map(attendanceData.subjects.map(s => [getSubjectKey(s), s]));
  const todaySubjects = todayCodes.map(code => subjectMap.get(code)).filter((s): s is typeof attendanceData.subjects[number] => !!s);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="UniTrack" className="w-8 h-8" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">UniTrack</h1>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle dark={dark} onToggle={toggleTheme} />
            <button
              onClick={() => setShowTimetableSetup(true)}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
              title="Timetable"
            >
              <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={() => setShowThresholdModal(true)}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
              title="Logout"
            >
              <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Student Info */}
        <StudentInfo
          student={attendanceData.student}
          lastUpdated={attendanceData.lastUpdated}
          onRefresh={handleRefresh}
          isLoading={isLoading}
        />

        {/* Today's Classes */}
        {hasTimetable ? (
          <>
            <TodayCard
              subjects={todaySubjects}
              globalThreshold={threshold}
              subjectThresholds={subjectThresholds}
            />
            <WeekOverview
              timetable={timetable}
              subjects={attendanceData.subjects}
              globalThreshold={threshold}
              subjectThresholds={subjectThresholds}
            />
          </>
        ) : (
          <button
            onClick={() => setShowTimetableSetup(true)}
            className="w-full bg-white dark:bg-slate-800/50 rounded-2xl p-4 border border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-colors text-left flex items-center gap-3 group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Set up your timetable</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">See which classes you can skip today</p>
            </div>
          </button>
        )}

        {/* Overall Stats */}
        <OverallStats
          subjects={attendanceData.subjects}
          globalThreshold={threshold}
          subjectThresholds={subjectThresholds}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />

        {/* Threshold indicator */}
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span>Default threshold:</span>
          <span className="font-semibold text-slate-900 dark:text-white">{threshold}%</span>
          <button
            onClick={() => setShowThresholdModal(true)}
            className="text-indigo-500 hover:text-indigo-600 text-xs font-medium"
          >
            Change
          </button>
          {customCount > 0 && (
            <span className="text-xs bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-md font-medium">
              {customCount} custom
            </span>
          )}
        </div>

        {/* Status Filter */}
        <StatusFilter
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          counts={statusCounts}
        />

        {/* Attendance Cards */}
        <div className="grid gap-3">
          {filteredSubjects.length > 0 ? (
            filteredSubjects.map((subject, index) => {
              const key = getSubjectKey(subject);
              const effectiveThreshold = getEffectiveThreshold(subject, threshold, subjectThresholds);
              return (
                <AttendanceCard
                  key={`${key}-${index}`}
                  subject={subject}
                  threshold={effectiveThreshold}
                  hasCustomThreshold={key in subjectThresholds}
                  onThresholdChange={(value) => handleSubjectThresholdChange(key, value)}
                />
              );
            })
          ) : (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p>No subjects match the selected filter</p>
            </div>
          )}
        </div>
      </main>

      {/* Threshold Modal */}
      <ThresholdModal
        isOpen={showThresholdModal}
        currentThreshold={threshold}
        onClose={() => setShowThresholdModal(false)}
        onSave={handleThresholdSave}
      />

      {/* Timetable Setup Modal */}
      <TimetableSetup
        isOpen={showTimetableSetup}
        onClose={() => setShowTimetableSetup(false)}
        onSave={setTimetable}
        subjects={attendanceData.subjects}
        currentTimetable={timetable}
      />

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-red-500 text-white p-4 rounded-2xl shadow-lg z-50">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-sm">Error</p>
              <p className="text-sm opacity-90">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import LoginForm from '@/components/LoginForm';
import StudentInfo from '@/components/StudentInfo';
import StatusFilter from '@/components/StatusFilter';
import AttendanceCard from '@/components/AttendanceCard';
import ThresholdModal from '@/components/ThresholdModal';
import { AttendanceData, LoginCredentials, StatusFilter as StatusFilterType, FetchResponse } from '@/lib/types';
import { STORAGE_KEY, CREDENTIALS_KEY, THRESHOLD_KEY, countByStatus } from '@/lib/utils';

export default function Home() {
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<StatusFilterType>('all');
  const [savedCredentials, setSavedCredentials] = useState<Partial<LoginCredentials>>({});
  const [threshold, setThreshold] = useState(75);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
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
          setSavedCredentials(JSON.parse(savedCreds));
        } catch {
          localStorage.removeItem(CREDENTIALS_KEY);
        }
      }

      const savedThreshold = localStorage.getItem(THRESHOLD_KEY);
      if (savedThreshold) {
        setThreshold(parseInt(savedThreshold) || 75);
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

  const fetchAttendance = useCallback(async (credentials: LoginCredentials, demo: boolean = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...credentials,
          threshold,
          demo,
        }),
      });

      const result: FetchResponse = await response.json();

      if (result.success && result.data) {
        setAttendanceData(result.data);
        // Save credentials (without password)
        localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({
          erpUrl: credentials.erpUrl,
          username: credentials.username,
        }));
        setSavedCredentials({
          erpUrl: credentials.erpUrl,
          username: credentials.username,
        });
      } else {
        setError(result.error || 'Failed to fetch attendance data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [threshold]);

  const handleLogout = () => {
    setAttendanceData(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleThresholdSave = (newThreshold: number) => {
    setThreshold(newThreshold);
    // Recalculate statuses with new threshold
    if (attendanceData) {
      const updatedSubjects = attendanceData.subjects.map(subject => ({
        ...subject,
        status: subject.percentage >= newThreshold + 5
          ? 'safe' as const
          : subject.percentage >= newThreshold
          ? 'critical' as const
          : 'low' as const,
      }));
      setAttendanceData({
        ...attendanceData,
        subjects: updatedSubjects,
        threshold: newThreshold,
      });
    }
  };

  // Show login form if no data
  if (!attendanceData) {
    return (
      <>
        <LoginForm
          onSubmit={fetchAttendance}
          isLoading={isLoading}
          savedCredentials={savedCredentials}
        />
        {error && (
          <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-red-500 text-white p-4 rounded-xl shadow-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium">Error</p>
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

  const filteredSubjects = activeFilter === 'all'
    ? attendanceData.subjects
    : attendanceData.subjects.filter(s => s.status === activeFilter);

  const statusCounts = countByStatus(attendanceData.subjects);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">UniTrack</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowThresholdModal(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Logout"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Student Info */}
        <StudentInfo
          student={attendanceData.student}
          lastUpdated={attendanceData.lastUpdated}
          onRefresh={() => fetchAttendance(savedCredentials as LoginCredentials)}
          isLoading={isLoading}
        />

        {/* Threshold indicator */}
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>Attendance threshold:</span>
          <span className="font-semibold text-gray-900 dark:text-white">{threshold}%</span>
          <button
            onClick={() => setShowThresholdModal(true)}
            className="text-indigo-500 hover:text-indigo-600 underline"
          >
            Change
          </button>
        </div>

        {/* Status Filter */}
        <StatusFilter
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          counts={statusCounts}
        />

        {/* Attendance Cards */}
        <div className="grid gap-4">
          {filteredSubjects.length > 0 ? (
            filteredSubjects.map((subject, index) => (
              <AttendanceCard
                key={`${subject.code}-${index}`}
                subject={subject}
                threshold={threshold}
              />
            ))
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
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

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-red-500 text-white p-4 rounded-xl shadow-lg z-50">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium">Error</p>
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

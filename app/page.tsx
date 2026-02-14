'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import PremiumBadge from '@/components/PremiumBadge';
import PremiumGate from '@/components/PremiumGate';
import UpgradeModal from '@/components/UpgradeModal';
import { useTheme } from '@/lib/useTheme';
import { useAuth } from '@/lib/useAuth';
import { loadUserData, saveUserData, saveErpCredentials, loadErpCredentials, incrementRefreshCount, savePayment, PaymentRecord } from '@/lib/firestore';
import { usePremium } from '@/lib/usePremium';
import { AttendanceData, StatusFilter as StatusFilterType, FetchResponse, Timetable } from '@/lib/types';
import {
  STORAGE_KEY, CREDENTIALS_KEY, THRESHOLD_KEY, SUBJECT_THRESHOLDS_KEY,
  ERP_URL_KEY, TIMETABLE_KEY,
  calculateStatus, getSubjectKey, getEffectiveThreshold,
} from '@/lib/utils';

export default function Home() {
  const { dark, toggle: toggleTheme, mounted } = useTheme();
  const { user, loading: authLoading, uniTrackPassword, setUniTrackPassword, login, signUp, logout } = useAuth();

  // Ref to always have the current uniTrackPassword (avoids stale closures in useCallback)
  const uniTrackPasswordRef = useRef(uniTrackPassword);
  uniTrackPasswordRef.current = uniTrackPassword;

  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<StatusFilterType>('all');
  const [savedUsername, setSavedUsername] = useState('');
  const [savedErpUrl, setSavedErpUrl] = useState('');
  const [threshold, setThreshold] = useState(75);
  const [subjectThresholds, setSubjectThresholds] = useState<Record<string, number>>({});
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [timetable, setTimetable] = useState<Timetable>({});
  const [showTimetableSetup, setShowTimetableSetup] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasErpCreds, setHasErpCreds] = useState(false);

  // Premium state
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [refreshCountResetMonth, setRefreshCountResetMonth] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const premiumStatus = usePremium({ premiumUntil, trialEndsAt, refreshCount, refreshCountResetMonth });

  // Safety: auto-reset loading after 60s to prevent stuck spinners
  useEffect(() => {
    if (!isLoading) return;
    const safety = setTimeout(() => {
      setIsLoading(false);
      setError('Request timed out. Please try again.');
    }, 60_000);
    return () => clearTimeout(safety);
  }, [isLoading]);

  // Password prompt modal state (for refresh after page reload)
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [promptPassword, setPromptPassword] = useState('');
  const [promptError, setPromptError] = useState('');

  // ── Load data from Firestore when user authenticates ──
  useEffect(() => {
    // Always clear stale state when user changes (logout, switch account, etc.)
    setAttendanceData(null);
    setSavedUsername('');
    setSavedErpUrl('');
    setActiveFilter('all');
    setHasErpCreds(false);
    setThreshold(75);
    setSubjectThresholds({});
    setTimetable({});
    setPremiumUntil(null);
    setTrialEndsAt(null);
    setRefreshCount(0);
    setRefreshCountResetMonth('');
    setShowUpgradeModal(false);
    setIsInitialized(false);
    setIsLoading(false);
    setError(null);
    setAuthError(null);

    if (!user) return;

    let cancelled = false;

    (async () => {
      try {
        const data = await loadUserData(user.uid);

        if (cancelled) return;

        if (data.attendance) setAttendanceData(data.attendance);
        if (data.threshold) setThreshold(data.threshold);
        if (data.subjectThresholds) setSubjectThresholds(data.subjectThresholds);
        if (data.timetable) setTimetable(data.timetable);
        if (data.erpUrl) setSavedErpUrl(data.erpUrl);
        setHasErpCreds(!!data.erpCredentials);
        if (data.premiumUntil) setPremiumUntil(data.premiumUntil);
        if (data.trialEndsAt) setTrialEndsAt(data.trialEndsAt);
        if (data.refreshCount) setRefreshCount(data.refreshCount);
        if (data.refreshCountResetMonth) setRefreshCountResetMonth(data.refreshCountResetMonth);

        // Migrate localStorage data on first sign-up (if Firestore is empty)
        if (!data.attendance && typeof window !== 'undefined') {
          const localData = localStorage.getItem(STORAGE_KEY);
          if (localData) {
            try {
              const parsed: AttendanceData = JSON.parse(localData);
              setAttendanceData(parsed);

              const localThreshold = parseInt(localStorage.getItem(THRESHOLD_KEY) || '') || 75;
              setThreshold(localThreshold);

              const localSubThresholds = JSON.parse(localStorage.getItem(SUBJECT_THRESHOLDS_KEY) || '{}');
              setSubjectThresholds(localSubThresholds);

              const localTimetable = JSON.parse(localStorage.getItem(TIMETABLE_KEY) || '{}');
              setTimetable(localTimetable);

              const localErpUrl = localStorage.getItem(ERP_URL_KEY) || '';
              setSavedErpUrl(localErpUrl);

              const localCreds = JSON.parse(localStorage.getItem(CREDENTIALS_KEY) || '{}');
              if (localCreds.username) setSavedUsername(localCreds.username);

              // Persist migrated data to Firestore
              await saveUserData(user.uid, {
                attendance: parsed,
                threshold: localThreshold,
                subjectThresholds: localSubThresholds,
                timetable: localTimetable,
                erpUrl: localErpUrl,
                lastSynced: new Date().toISOString(),
              });

              // Clear localStorage after successful migration
              localStorage.removeItem(STORAGE_KEY);
              localStorage.removeItem(CREDENTIALS_KEY);
              localStorage.removeItem(THRESHOLD_KEY);
              localStorage.removeItem(SUBJECT_THRESHOLDS_KEY);
              localStorage.removeItem(ERP_URL_KEY);
              localStorage.removeItem(TIMETABLE_KEY);
            } catch {
              // Ignore migration errors
            }
          }
        }
      } catch {
        // Firestore load failed — user will see empty state
      }

      if (!cancelled) setIsInitialized(true);
    })();

    return () => { cancelled = true; };
  }, [user]);

  // ── Save attendance to Firestore when it changes ──
  useEffect(() => {
    if (!isInitialized || !user || !attendanceData) return;
    saveUserData(user.uid, {
      attendance: attendanceData,
      lastSynced: new Date().toISOString(),
    });
  }, [attendanceData, isInitialized, user]);

  // ── Save threshold to Firestore when it changes ──
  useEffect(() => {
    if (!isInitialized || !user) return;
    saveUserData(user.uid, { threshold });
  }, [threshold, isInitialized, user]);

  // ── Save subject thresholds to Firestore when they change ──
  useEffect(() => {
    if (!isInitialized || !user) return;
    saveUserData(user.uid, { subjectThresholds });
  }, [subjectThresholds, isInitialized, user]);

  // ── Save timetable to Firestore when it changes ──
  useEffect(() => {
    if (!isInitialized || !user) return;
    saveUserData(user.uid, { timetable });
  }, [timetable, isInitialized, user]);

  // ── Auth handlers ──
  const handleAuth = async (email: string, password: string, isSignUp: boolean) => {
    setAuthError(null);
    setIsLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      // Friendlier Firebase error messages
      if (msg.includes('auth/email-already-in-use')) setAuthError('This email is already registered. Try signing in.');
      else if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) setAuthError('Invalid email or password.');
      else if (msg.includes('auth/weak-password')) setAuthError('Password must be at least 6 characters.');
      else if (msg.includes('auth/invalid-email')) setAuthError('Please enter a valid email address.');
      else if (msg.includes('auth/too-many-requests')) setAuthError('Too many attempts. Try again later.');
      else setAuthError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Fetch attendance from ERP ──
  const fetchAttendance = useCallback(async (erpUrl: string, username: string, password: string, encryptionPassword?: string) => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55_000); // 55s fetch timeout

      const response = await fetch('/api/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ erpUrl, username, password, threshold }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const result: FetchResponse = await response.json();

      if (result.success && result.data) {
        const isFirstFetch = !attendanceData;
        setAttendanceData(result.data);
        setSavedUsername(username);
        setSavedErpUrl(erpUrl);

        // Encrypt & save ERP credentials to Firestore
        const pwForEncrypt = encryptionPassword || uniTrackPasswordRef.current;
        if (pwForEncrypt) {
          try {
            await saveErpCredentials(user.uid, erpUrl, username, password, pwForEncrypt);
            setHasErpCreds(true);
          } catch (saveErr) {
            console.error('Failed to save ERP credentials:', saveErr);
          }
        }

        // Increment refresh count for free users (skip on first-ever fetch)
        if (!isFirstFetch && !premiumStatus.isPremium) {
          const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
          const updated = await incrementRefreshCount(user.uid, currentMonth, refreshCount, refreshCountResetMonth);
          setRefreshCount(updated.refreshCount);
          setRefreshCountResetMonth(updated.refreshCountResetMonth);
        }
      } else {
        setError(result.error || 'Failed to fetch attendance data');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Request timed out — the ERP server took too long to respond. Try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Network error — check your connection');
      }
    } finally {
      setIsLoading(false);
    }
  }, [threshold, user, attendanceData, premiumStatus.isPremium, refreshCount, refreshCountResetMonth]);

  // ── Handle refresh ──
  const handleRefresh = async () => {
    if (!user) return;

    // Check refresh limit for free users
    if (!premiumStatus.canRefresh) {
      setShowUpgradeModal(true);
      return;
    }

    // If we have the UniTrack password in memory, decrypt and fetch directly
    if (uniTrackPassword) {
      try {
        const creds = await loadErpCredentials(user.uid, uniTrackPassword);
        if (creds) {
          fetchAttendance(creds.erpUrl, creds.username, creds.password, uniTrackPassword);
          return;
        }
      } catch {
        // Decryption or Firestore error — fall through to password prompt
      }
    }

    // Password not in memory or decryption failed — check Firestore directly
    // (more robust than relying on hasErpCreds state which can get out of sync)
    if (hasErpCreds || attendanceData) {
      setShowPasswordPrompt(true);
      return;
    }

    // No ERP creds at all — nothing to refresh
    setError('No saved ERP credentials. Please connect your ERP first.');
  };

  // ── Handle password prompt submit (for refresh after reload) ──
  const handlePasswordPromptSubmit = async () => {
    if (!user || !promptPassword || isLoading) return;
    setPromptError('');
    setIsLoading(true);

    try {
      // First check if credentials exist in Firestore at all
      const userData = await loadUserData(user.uid);
      if (!userData.erpCredentials) {
        setPromptError('No saved credentials found. Please reconnect your ERP.');
        setIsLoading(false);
        return;
      }

      const creds = await loadErpCredentials(user.uid, promptPassword);
      if (!creds) {
        setPromptError('Wrong password. Please try again.');
        setIsLoading(false);
        return;
      }

      setUniTrackPassword(promptPassword);
      setShowPasswordPrompt(false);
      setPromptPassword('');
      fetchAttendance(creds.erpUrl, creds.username, creds.password, promptPassword);
    } catch {
      setPromptError('Something went wrong. Try again or reconnect your ERP.');
      setIsLoading(false);
    }
  };

  // ── Reconnect ERP (clear data so ERP form shows) ──
  const handleReconnectErp = () => {
    setAttendanceData(null);
    setHasErpCreds(false);
    setShowPasswordPrompt(false);
    setPromptPassword('');
    setPromptError('');
  };

  // ── Logout ──
  const handleLogout = async () => {
    setAttendanceData(null);
    setSavedUsername('');
    setSavedErpUrl('');
    setActiveFilter('all');
    setHasErpCreds(false);
    setThreshold(75);
    setSubjectThresholds({});
    setTimetable({});
    setPremiumUntil(null);
    setTrialEndsAt(null);
    setRefreshCount(0);
    setRefreshCountResetMonth('');
    setShowUpgradeModal(false);
    setIsInitialized(false);
    await logout();
  };

  const handleThresholdSave = (newThreshold: number) => {
    setThreshold(newThreshold);
  };

  const handlePaymentSuccess = async (newPremiumUntil: string, payment: PaymentRecord) => {
    setPremiumUntil(newPremiumUntil);
    if (user) {
      await savePayment(user.uid, newPremiumUntil, payment);
    }
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

  // ── Loading state ──
  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <img src="/logo.png" alt="UniTrack" className="w-14 h-14 animate-pulse" />
      </div>
    );
  }

  // ── Not logged in → Auth form ──
  if (!user) {
    return (
      <>
        <LoginForm
          mode="auth"
          onAuth={handleAuth}
          isLoading={isLoading}
          authError={authError || undefined}
          dark={dark}
          onToggleTheme={toggleTheme}
        />
      </>
    );
  }

  // ── Logged in but Firestore data still loading ──
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <img src="/logo.png" alt="UniTrack" className="w-14 h-14 animate-pulse" />
      </div>
    );
  }

  // ── Logged in but no attendance data and no ERP creds → ERP connection form ──
  if (!attendanceData && !hasErpCreds) {
    return (
      <>
        <LoginForm
          mode="erp"
          onSubmit={fetchAttendance}
          isLoading={isLoading}
          savedUsername={savedUsername}
          savedErpUrl={savedErpUrl}
          dark={dark}
          onToggleTheme={toggleTheme}
          onLogout={handleLogout}
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

  // ── Logged in, has ERP creds but no attendance data yet → also show ERP form ──
  if (!attendanceData) {
    return (
      <>
        <LoginForm
          mode="erp"
          onSubmit={fetchAttendance}
          isLoading={isLoading}
          savedUsername={savedUsername}
          savedErpUrl={savedErpUrl}
          dark={dark}
          onToggleTheme={toggleTheme}
          onLogout={handleLogout}
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

  // ── Dashboard ──

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
            <PremiumBadge status={premiumStatus} onUpgradeClick={() => setShowUpgradeModal(true)} />
            <ThemeToggle dark={dark} onToggle={toggleTheme} />
            <button
              onClick={() => premiumStatus.isPremium ? setShowTimetableSetup(true) : setShowUpgradeModal(true)}
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
          premiumStatus={premiumStatus}
        />

        {/* Today's Classes */}
        {hasTimetable ? (
          <PremiumGate isPremium={premiumStatus.isPremium} onUpgradeClick={() => setShowUpgradeModal(true)}>
            <TodayCard
              subjects={todaySubjects}
              globalThreshold={threshold}
              subjectThresholds={subjectThresholds}
            />
            <div className="mt-5">
              <WeekOverview
                timetable={timetable}
                subjects={attendanceData.subjects}
                globalThreshold={threshold}
                subjectThresholds={subjectThresholds}
              />
            </div>
          </PremiumGate>
        ) : (
          <button
            onClick={() => premiumStatus.isPremium ? setShowTimetableSetup(true) : setShowUpgradeModal(true)}
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
                  isPremium={premiumStatus.isPremium}
                  onUpgradeClick={() => setShowUpgradeModal(true)}
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

      {/* Password Prompt Modal (for refresh after page reload) */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Enter your password</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Your UniTrack password is needed to decrypt your saved ERP credentials.
            </p>
            <input
              type="password"
              value={promptPassword}
              onChange={(e) => setPromptPassword(e.target.value)}
              placeholder="UniTrack password"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all text-sm mb-3"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePasswordPromptSubmit();
              }}
            />
            {promptError && (
              <div className="mb-3">
                <p className="text-sm text-red-500">{promptError}</p>
                {promptError.includes('reconnect') && (
                  <button
                    onClick={handleReconnectErp}
                    className="text-sm text-indigo-500 hover:text-indigo-600 font-medium mt-1"
                  >
                    Reconnect ERP →
                  </button>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowPasswordPrompt(false);
                  setPromptPassword('');
                  setPromptError('');
                }}
                disabled={isLoading}
                className="flex-1 py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordPromptSubmit}
                disabled={isLoading}
                className="flex-1 py-2 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-medium hover:from-indigo-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        premiumStatus={premiumStatus}
        uid={user.uid}
        email={user.email || ''}
        currentPremiumUntil={premiumUntil}
        onPaymentSuccess={handlePaymentSuccess}
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

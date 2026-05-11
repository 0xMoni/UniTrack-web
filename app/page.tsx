'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import LoginForm from '@/components/LoginForm';
import StudentInfo from '@/components/StudentInfo';
import StatusFilter from '@/components/StatusFilter';
import AttendanceCard from '@/components/AttendanceCard';
import ThresholdModal from '@/components/ThresholdModal';
import TimetableSetup from '@/components/TimetableSetup';
import TodayCard from '@/components/TodayCard';
import WeekOverview from '@/components/WeekOverview';
import OverallStats from '@/components/OverallStats';
import Header from '@/components/Header';
import PremiumGate from '@/components/PremiumGate';
import UpgradeModal from '@/components/UpgradeModal';
import VacationPlanner from '@/components/VacationPlanner';
import { SkeletonDashboard } from '@/components/Skeleton';
import { useTheme } from '@/lib/useTheme';
import { useAuth } from '@/lib/useAuth';
import { loadUserData, saveUserData, saveErpCredentials, loadErpCredentials, incrementRefreshCount, savePayment, subscribeToUserData, PaymentRecord } from '@/lib/firestore';
import { usePremium } from '@/lib/usePremium';
import { AttendanceData, StatusFilter as StatusFilterType, FetchResponse, Timetable } from '@/lib/types';
import {
  STORAGE_KEY, CREDENTIALS_KEY, THRESHOLD_KEY, SUBJECT_THRESHOLDS_KEY,
  ERP_URL_KEY, TIMETABLE_KEY,
  calculateStatus, getSubjectKey, getEffectiveThreshold,
} from '@/lib/utils';

const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

export default function Home() {
  const { dark, toggle: toggleTheme, mounted } = useTheme();
  const { user, loading: authLoading, login, signUp, logout } = useAuth();

  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const autoRefreshTriggered = useRef(false);

  // Premium state
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [refreshCountResetMonth, setRefreshCountResetMonth] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const premiumStatus = usePremium({ premiumUntil, trialEndsAt, refreshCount, refreshCountResetMonth });

  // ── Load data from Firestore when user authenticates ──
  useEffect(() => {
    // Always clear stale state when user changes (logout, switch account, etc.)
    setAttendanceData(null);
    setSavedUsername('');
    setSavedErpUrl('');
    setActiveFilter('all');
    setThreshold(75);
    setSubjectThresholds({});
    setTimetable({});
    setPremiumUntil(null);
    setTrialEndsAt(null);
    setRefreshCount(0);
    setRefreshCountResetMonth('');
    setShowUpgradeModal(false);
    setIsInitialized(false);
    setIsAutoRefreshing(false);
    autoRefreshTriggered.current = false;
    setIsLoading(false);
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

  // ── Real-time sync for premium status ──
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUserData(user.uid, (data) => {
      if (data.premiumUntil) setPremiumUntil(data.premiumUntil);
      if (data.trialEndsAt) setTrialEndsAt(data.trialEndsAt);
      if (data.refreshCount !== undefined) setRefreshCount(data.refreshCount);
      if (data.refreshCountResetMonth) setRefreshCountResetMonth(data.refreshCountResetMonth);
    });
    return () => unsubscribe();
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
  const fetchAttendance = useCallback(async (erpUrl: string, username: string, password: string) => {
    if (!user) return;
    setIsLoading(true);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000); // 25s fetch timeout

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

        // Encrypt & save ERP credentials (encrypted with UID, no password needed)
        try {
          await saveErpCredentials(user.uid, erpUrl, username, password);
        } catch {
          // Credential save failed — non-critical, user can re-enter next time
        }

        // Increment refresh count for free users (skip on first-ever fetch)
        if (!isFirstFetch && !premiumStatus.isPremium) {
          const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
          const updated = await incrementRefreshCount(user.uid, currentMonth, refreshCount, refreshCountResetMonth);
          setRefreshCount(updated.refreshCount);
          setRefreshCountResetMonth(updated.refreshCountResetMonth);
        }
      } else {
        toast.error(result.error || 'Failed to fetch attendance data');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast.error('Request timed out — the ERP server took too long to respond. Try again.');
      } else {
        toast.error(err instanceof Error ? err.message : 'Network error — check your connection');
      }
    } finally {
      setIsLoading(false);
    }
  }, [threshold, user, attendanceData, premiumStatus.isPremium, refreshCount, refreshCountResetMonth]);

  // ── Auto-refresh callback (best-effort, silent errors) ──
  const autoRefresh = useCallback(async () => {
    if (!user || !attendanceData || !premiumStatus.canRefresh) return;

    setIsAutoRefreshing(true);
    try {
      const creds = await loadErpCredentials(user.uid);
      if (!creds) return;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);

      const response = await fetch('/api/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ erpUrl: creds.erpUrl, username: creds.username, password: creds.password, threshold }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const result: FetchResponse = await response.json();

      if (result.success && result.data) {
        setAttendanceData(result.data);

        // Increment refresh count for free users
        if (!premiumStatus.isPremium) {
          const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
          const updated = await incrementRefreshCount(user.uid, currentMonth, refreshCount, refreshCountResetMonth);
          setRefreshCount(updated.refreshCount);
          setRefreshCountResetMonth(updated.refreshCountResetMonth);
        }
      }
    } catch {
      // Silent failure — auto-refresh is best-effort
    } finally {
      setIsAutoRefreshing(false);
    }
  }, [user, attendanceData, premiumStatus.canRefresh, premiumStatus.isPremium, threshold, refreshCount, refreshCountResetMonth]);

  // ── Trigger auto-refresh once after initialization if data is stale ──
  useEffect(() => {
    if (!isInitialized || !attendanceData || autoRefreshTriggered.current) return;
    autoRefreshTriggered.current = true;

    const lastUpdated = new Date(attendanceData.lastUpdated).getTime();
    const age = Date.now() - lastUpdated;

    if (age > STALE_THRESHOLD_MS) {
      autoRefresh();
    }
  }, [isInitialized, attendanceData, autoRefresh]);

  // ── Logout ──
  const handleLogout = async () => {
    setAttendanceData(null);
    setSavedUsername('');
    setSavedErpUrl('');
    setActiveFilter('all');
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
    return calculateStatus(subject.percentage, t, subject.total);
  };

  // ── Loading state ──
  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Image src="/logo.png" alt="UniTrack" width={56} height={56} className="animate-pulse" />
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <SkeletonDashboard />
        </div>
      </div>
    );
  }


  // ── Logged in but no attendance data → ERP connection form ──
  if (!attendanceData) {
    return (
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
    { safe: 0, critical: 0, low: 0, no_data: 0 }
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
      <Header
        dark={dark}
        onToggleTheme={toggleTheme}
        premiumStatus={premiumStatus}
        onUpgradeClick={() => setShowUpgradeModal(true)}
        onThresholdClick={() => setShowThresholdModal(true)}
        onTimetableClick={() => premiumStatus.isPremium ? setShowTimetableSetup(true) : setShowUpgradeModal(true)}
        onLogout={handleLogout}
        isRefreshing={isLoading || isAutoRefreshing}
        onRefresh={autoRefresh}
        lastUpdated={attendanceData.lastUpdated}
        canRefresh={premiumStatus.canRefresh}
      />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <StudentInfo
          student={attendanceData.student}
          lastUpdated={attendanceData.lastUpdated}
        />

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

        <OverallStats
          subjects={attendanceData.subjects}
          globalThreshold={threshold}
          subjectThresholds={subjectThresholds}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />

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

        <StatusFilter
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          counts={statusCounts}
        />

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

        {hasTimetable && (
          <PremiumGate isPremium={premiumStatus.isPremium} onUpgradeClick={() => setShowUpgradeModal(true)}>
            <VacationPlanner
              subjects={attendanceData.subjects}
              timetable={timetable}
              globalThreshold={threshold}
              subjectThresholds={subjectThresholds}
            />
          </PremiumGate>
        )}

        <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 mt-6 pb-4">
          © 2026 0xMoni
        </p>
      </main>

      <ThresholdModal
        isOpen={showThresholdModal}
        currentThreshold={threshold}
        onClose={() => setShowThresholdModal(false)}
        onSave={handleThresholdSave}
      />

      <TimetableSetup
        isOpen={showTimetableSetup}
        onClose={() => setShowTimetableSetup(false)}
        onSave={setTimetable}
        subjects={attendanceData.subjects}
        currentTimetable={timetable}
        isPremium={premiumStatus.isPremium}
        onUpgradeClick={() => { setShowTimetableSetup(false); setShowUpgradeModal(true); }}
      />

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        premiumStatus={premiumStatus}
        uid={user.uid}
        email={user.email || ''}
        currentPremiumUntil={premiumUntil}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
}

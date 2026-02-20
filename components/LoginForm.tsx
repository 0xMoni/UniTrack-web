'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import ThemeToggle from './ThemeToggle';

const LOADING_MESSAGES = [
  'Connecting to ERP...',
  'Praying to the attendance gods...',
  'Bribing the ERP hamsters...',
  'Sneaking into the server room...',
  'Calculating bunkable lectures...',
  'Hacking the mainframe... jk',
  'Loading faster than your 8am lecture...',
  'Dodging the proxy attendance check...',
  'This is still faster than the ERP itself...',
  'Begging the server to respond...',
  'Counting every lecture you slept through...',
  'Your ERP runs on a potato btw...',
  'Asking your professor nicely...',
  'Finding who has 100% attendance... nobody',
  'Almost there, don\'t refresh...',
];

// Auth mode: sign in / sign up with UniTrack (Firebase) account
interface AuthModeProps {
  mode: 'auth';
  onAuth: (email: string, password: string, isSignUp: boolean) => void;
  isLoading: boolean;
  authError?: string;
  dark: boolean;
  onToggleTheme: () => void;
}

// ERP mode: connect ERP credentials (after auth)
interface ErpModeProps {
  mode: 'erp';
  onSubmit: (erpUrl: string, username: string, password: string) => void;
  isLoading: boolean;
  savedUsername?: string;
  savedErpUrl?: string;
  dark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
}

type LoginFormProps = AuthModeProps | ErpModeProps;

function PasswordToggleIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

export default function LoginForm(props: LoginFormProps) {
  const { mode, isLoading, dark, onToggleTheme } = props;

  const [email, setEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const savedErpUrl = mode === 'erp' ? props.savedErpUrl : undefined;
  const savedUsername = mode === 'erp' ? props.savedUsername : undefined;
  const [erpUrl, setErpUrl] = useState(savedErpUrl || '');
  const [username, setUsername] = useState(savedUsername || '');
  const [erpPassword, setErpPassword] = useState('');
  const [showErpPassword, setShowErpPassword] = useState(false);

  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'auth') {
      props.onAuth(email, authPassword, isSignUp);
    }
  };

  const handleErpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'erp') {
      props.onSubmit(erpUrl, username, erpPassword);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Theme toggle - top right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle dark={dark} onToggle={onToggleTheme} />
      </div>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <Image src="/logo.png" alt="UniTrack" width={64} height={64} className="mx-auto mb-5" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">UniTrack</h1>
          <p className="text-slate-400 dark:text-slate-500 mt-1 text-sm">Attendance Tracker</p>
        </div>

        {mode === 'auth' ? (
          /* ──── Auth Mode ──── */
          <form onSubmit={handleAuthSubmit} className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm p-6 space-y-4 border border-slate-200 dark:border-slate-700/50 backdrop-blur-sm">
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 pb-1">
              {isSignUp ? 'Create your UniTrack account' : 'Sign in to UniTrack'}
            </p>

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all text-sm"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="authPassword" className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="authPassword"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder={isSignUp ? 'Choose a password (min 6 chars)' : 'Enter your password'}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all text-sm"
                  required
                  minLength={6}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  <PasswordToggleIcon visible={showPassword} />
                </button>
              </div>
            </div>

            {props.authError && (
              <p className="text-sm text-red-500 text-center">{props.authError}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-medium shadow-sm hover:shadow-md hover:from-indigo-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Please wait...
                </span>
              ) : isSignUp ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>

            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-indigo-500 hover:text-indigo-600 font-medium"
                disabled={isLoading}
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </form>
        ) : (
          /* ──── ERP Mode ──── */
          <form onSubmit={handleErpSubmit} className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm p-6 space-y-4 border border-slate-200 dark:border-slate-700/50 backdrop-blur-sm">
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 pb-1">
              Connect your ERP to fetch attendance
            </p>

            <div className="space-y-1.5">
              <label htmlFor="erpUrl" className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                ERP URL
              </label>
              <input
                type="url"
                id="erpUrl"
                value={erpUrl}
                onChange={(e) => setErpUrl(e.target.value)}
                placeholder="https://erp.yourcollege.ac.in"
                autoComplete="url"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all text-sm"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your.email@college.ac.in"
                autoComplete="username"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all text-sm"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="erpPassword" className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showErpPassword ? 'text' : 'password'}
                  id="erpPassword"
                  value={erpPassword}
                  onChange={(e) => setErpPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all text-sm"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowErpPassword(!showErpPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  <PasswordToggleIcon visible={showErpPassword} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-medium shadow-sm hover:shadow-md hover:from-indigo-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {LOADING_MESSAGES[msgIndex]}
                </span>
              ) : (
                'Fetch My Attendance'
              )}
            </button>

            <button
              type="button"
              onClick={props.onLogout}
              disabled={isLoading}
              className="w-full py-2 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              Sign out
            </button>
          </form>
        )}

        <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 mt-5">
          {mode === 'erp' ? (
            <>
              Your credentials are sent directly to the ERP server.
              <br />
              They are encrypted and stored securely.
            </>
          ) : (
            <>
              Your data syncs across devices securely.
              <br />
              ERP credentials are encrypted with your password.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

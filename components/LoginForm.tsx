'use client';

import { useState, useEffect } from 'react';
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

interface LoginFormProps {
  onSubmit: (erpUrl: string, username: string, password: string) => void;
  isLoading: boolean;
  savedUsername?: string;
  savedErpUrl?: string;
  dark: boolean;
  onToggleTheme: () => void;
}

export default function LoginForm({ onSubmit, isLoading, savedUsername, savedErpUrl, dark, onToggleTheme }: LoginFormProps) {
  const [erpUrl, setErpUrl] = useState(savedErpUrl || '');
  const [username, setUsername] = useState(savedUsername || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setMsgIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(erpUrl, username, password);
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
          <img src="/logo.png" alt="UniTrack" className="w-16 h-16 mx-auto mb-5" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">UniTrack</h1>
          <p className="text-slate-400 dark:text-slate-500 mt-1 text-sm">Attendance Tracker</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm p-6 space-y-4 border border-slate-200 dark:border-slate-700/50 backdrop-blur-sm">
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 pb-1">
            Sign in with your ERP credentials
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
            <label htmlFor="password" className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 outline-none transition-all text-sm"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
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
        </form>

        <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 mt-5">
          Your credentials are sent directly to the ERP server.
          <br />
          We never store your password.
        </p>
      </div>
    </div>
  );
}

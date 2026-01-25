'use client';

import { useState } from 'react';
import { LoginCredentials } from '@/lib/types';

interface LoginFormProps {
  onSubmit: (credentials: LoginCredentials, demo?: boolean) => void;
  isLoading: boolean;
  savedCredentials?: Partial<LoginCredentials>;
}

export default function LoginForm({ onSubmit, isLoading, savedCredentials }: LoginFormProps) {
  const [erpUrl, setErpUrl] = useState(savedCredentials?.erpUrl || '');
  const [username, setUsername] = useState(savedCredentials?.username || '');
  const [password, setPassword] = useState('');
  const [rememberCredentials, setRememberCredentials] = useState(true);

  const handleSubmit = (e: React.FormEvent, demo: boolean = false) => {
    e.preventDefault();
    onSubmit({ erpUrl, username, password }, demo);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">UniTrack</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Universal Attendance Tracker</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-5 border border-gray-100 dark:border-gray-700">
          <div>
            <label htmlFor="erpUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ERP Portal URL
            </label>
            <input
              type="url"
              id="erpUrl"
              value={erpUrl}
              onChange={(e) => setErpUrl(e.target.value)}
              placeholder="https://erp.university.edu"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              required={!isLoading}
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Username / USN
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="1XX22CS001"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              required={!isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              required={!isLoading}
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="remember"
              checked={rememberCredentials}
              onChange={(e) => setRememberCredentials(e.target.checked)}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="remember" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              Remember credentials (stored locally)
            </label>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Fetching Attendance...
                </span>
              ) : (
                'Fetch Attendance'
              )}
            </button>

            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Try Demo Mode
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
          Your credentials are never stored on any server.
          <br />
          All data is processed locally.
        </p>
      </div>
    </div>
  );
}

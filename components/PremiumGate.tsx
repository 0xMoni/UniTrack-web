'use client';

import { ReactNode } from 'react';

interface PremiumGateProps {
  isPremium: boolean;
  onUpgradeClick: () => void;
  children: ReactNode;
}

export default function PremiumGate({ isPremium, onUpgradeClick, children }: PremiumGateProps) {
  if (isPremium) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none blur-[2px] select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/30 dark:bg-slate-900/30 rounded-2xl">
        <button
          onClick={onUpgradeClick}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all"
        >
          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Upgrade to unlock</span>
        </button>
      </div>
    </div>
  );
}

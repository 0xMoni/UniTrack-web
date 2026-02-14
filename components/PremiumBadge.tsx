'use client';

import { PremiumStatus } from '@/lib/usePremium';

interface PremiumBadgeProps {
  status: PremiumStatus;
  onUpgradeClick: () => void;
}

export default function PremiumBadge({ status, onUpgradeClick }: PremiumBadgeProps) {
  if (status.isPaidPremium) {
    return (
      <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 text-xs font-bold tracking-wide">
        PRO
      </span>
    );
  }

  if (status.isTrialActive) {
    return (
      <button
        onClick={onUpgradeClick}
        className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 text-xs font-medium hover:bg-indigo-500/20 transition-colors"
      >
        Upgrade
      </button>
    );
  }

  return (
    <button
      onClick={onUpgradeClick}
      className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 text-xs font-medium hover:bg-indigo-500/20 transition-colors"
    >
      Upgrade
    </button>
  );
}

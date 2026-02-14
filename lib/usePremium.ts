'use client';

import { useMemo } from 'react';

const FREE_REFRESHES_PER_MONTH = 3;

interface UsePremiumInput {
  premiumUntil: string | null;
  trialEndsAt: string | null;
  refreshCount: number;
  refreshCountResetMonth: string;
}

export interface PremiumStatus {
  isPremium: boolean;
  isTrialActive: boolean;
  isPaidPremium: boolean;
  trialDaysLeft: number;
  premiumDaysLeft: number;
  refreshesUsed: number;
  refreshesLeft: number;
  canRefresh: boolean;
}

export function usePremium({ premiumUntil, trialEndsAt, refreshCount, refreshCountResetMonth }: UsePremiumInput): PremiumStatus {
  return useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const isPaidPremium = !!premiumUntil && new Date(premiumUntil) > now;
    const isTrialActive = !!trialEndsAt && new Date(trialEndsAt) > now;
    const isPremium = isPaidPremium || isTrialActive;

    const trialDaysLeft = isTrialActive
      ? Math.ceil((new Date(trialEndsAt!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const premiumDaysLeft = isPaidPremium
      ? Math.ceil((new Date(premiumUntil!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Lazy monthly reset: if stored month doesn't match current, treat as 0
    const refreshesUsed = refreshCountResetMonth === currentMonth ? refreshCount : 0;
    const refreshesLeft = isPremium ? Infinity : Math.max(0, FREE_REFRESHES_PER_MONTH - refreshesUsed);
    const canRefresh = isPremium || refreshesLeft > 0;

    return {
      isPremium,
      isTrialActive,
      isPaidPremium,
      trialDaysLeft,
      premiumDaysLeft,
      refreshesUsed,
      refreshesLeft,
      canRefresh,
    };
  }, [premiumUntil, trialEndsAt, refreshCount, refreshCountResetMonth]);
}

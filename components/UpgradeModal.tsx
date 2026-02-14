'use client';

import { useState } from 'react';
import { PremiumStatus } from '@/lib/usePremium';
import { loadRazorpayScript } from '@/lib/razorpay';
import { PaymentRecord } from '@/lib/firestore';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  premiumStatus: PremiumStatus;
  uid: string;
  email: string;
  currentPremiumUntil: string | null;
  onPaymentSuccess: (premiumUntil: string, payment: PaymentRecord) => void;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function UpgradeModal({ isOpen, onClose, premiumStatus, uid, email, currentPremiumUntil, onPaymentSuccess }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handlePayment = async () => {
    setLoading(true);
    setError('');

    try {
      // Load Razorpay script lazily
      await loadRazorpayScript();

      // Create order on server
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, email }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create order');

      // Open Razorpay checkout
      const rzp = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'UniTrack',
        description: 'Premium — 30 days',
        order_id: orderData.orderId,
        prefill: { email },
        theme: { color: '#6366f1' },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            // Verify payment on server
            const verifyRes = await fetch('/api/payments/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...response,
                uid,
                currentPremiumUntil,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Verification failed');

            onPaymentSuccess(verifyData.premiumUntil, verifyData.payment);
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Payment verification failed');
          }
          setLoading(false);
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });

      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Upgrade to Premium</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Current status */}
          {premiumStatus.isPaidPremium && (
            <div className="mb-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                Premium active — {premiumStatus.premiumDaysLeft} days remaining
              </p>
              <p className="text-xs text-indigo-500/70 mt-0.5">Renewing now extends from your current expiry date</p>
            </div>
          )}
          {premiumStatus.isTrialActive && !premiumStatus.isPaidPremium && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Trial active — {premiumStatus.trialDaysLeft} days left
              </p>
            </div>
          )}

          {/* Plan comparison */}
          <div className="grid grid-cols-2 gap-3">
            {/* Free */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Free</p>
              <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                <li className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Attendance dashboard
                </li>
                <li className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Global threshold
                </li>
                <li className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  3 refreshes/month
                </li>
                <li className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  <span className="text-slate-400 dark:text-slate-500">Per-subject thresholds</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  <span className="text-slate-400 dark:text-slate-500">Timetable features</span>
                </li>
              </ul>
            </div>

            {/* Premium */}
            <div className="p-3.5 rounded-xl border-2 border-indigo-500 bg-indigo-500/5 space-y-2.5 relative">
              <div className="absolute -top-2.5 right-3 px-2 py-0.5 bg-indigo-500 text-white text-[10px] font-bold rounded-md uppercase tracking-wider">
                Best value
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Premium</p>
                <p className="text-lg font-bold text-indigo-500">Rs 29<span className="text-xs font-normal text-slate-400">/mo</span></p>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                <li className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Everything in Free
                </li>
                <li className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span className="font-medium text-slate-700 dark:text-slate-300">Unlimited refreshes</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span className="font-medium text-slate-700 dark:text-slate-300">Per-subject thresholds</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span className="font-medium text-slate-700 dark:text-slate-300">Timetable features</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-2 space-y-3">
          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}
          <button
            onClick={handlePayment}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold hover:from-indigo-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Processing...' : premiumStatus.isPaidPremium ? 'Renew — Rs 29' : 'Pay Rs 29'}
          </button>
          <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">
            One-time payment for 30 days. No auto-renewal.
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { getFirebaseDb } from '../../lib/firebase';
import type { PaymentRecord, UserData } from '../../lib/firestore';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UserRow {
  uid: string;
  premiumUntil: string | null;
  trialEndsAt: string | null;
  refreshCount: number;
  lastSynced: string;
  payments: PaymentRecord[];
}

type Tab = 'overview' | 'users' | 'payments';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtDate(d: string | null): string {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtCurrency(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function premiumLabel(u: UserRow): { text: string; color: string } {
  const now = new Date();
  if (u.premiumUntil && new Date(u.premiumUntil) > now) {
    return { text: 'Active', color: 'text-emerald-400' };
  }
  if (u.premiumUntil && new Date(u.premiumUntil) <= now) {
    return { text: 'Expired', color: 'text-amber-400' };
  }
  if (u.trialEndsAt && new Date(u.trialEndsAt) > now) {
    return { text: 'Trial', color: 'text-sky-400' };
  }
  return { text: 'Free', color: 'text-slate-400' };
}

/* ------------------------------------------------------------------ */
/*  Password Gate                                                      */
/* ------------------------------------------------------------------ */

function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw === 'unitrack-admin-0xmoni') {
      sessionStorage.setItem('admin_auth', '1');
      onAuth();
    } else {
      setError(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-slate-800/60 border border-slate-700 rounded-2xl p-8 space-y-5"
      >
        <h1 className="text-xl font-semibold text-slate-100 text-center">
          UniTrack Admin
        </h1>
        <div>
          <label htmlFor="admin-pw" className="block text-sm text-slate-400 mb-1.5">
            Password
          </label>
          <input
            id="admin-pw"
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setError(false);
            }}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3.5 py-2.5 text-base text-slate-100 placeholder-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            placeholder="Enter admin password"
          />
          {error && (
            <p className="mt-1.5 text-sm text-red-400">Incorrect password</p>
          )}
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 cursor-pointer"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-100">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                          */
/* ------------------------------------------------------------------ */

function Dashboard() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = getFirebaseDb();
      const snap = await getDocs(collection(db, 'users'));
      const rows: UserRow[] = [];
      snap.forEach((doc) => {
        const d = doc.data() as Partial<UserData>;
        rows.push({
          uid: doc.id,
          premiumUntil: d.premiumUntil ?? null,
          trialEndsAt: d.trialEndsAt ?? null,
          refreshCount: d.refreshCount ?? 0,
          lastSynced: d.lastSynced ?? '',
          payments: d.payments ?? [],
        });
      });
      setUsers(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* Derived stats */
  const now = useMemo(() => new Date(), []);

  const stats = useMemo(() => {
    const total = users.length;
    const premium = users.filter(
      (u) => u.premiumUntil && new Date(u.premiumUntil) > now,
    ).length;
    const trial = users.filter(
      (u) =>
        u.trialEndsAt &&
        new Date(u.trialEndsAt) > now &&
        (!u.premiumUntil || new Date(u.premiumUntil) <= now),
    ).length;
    const totalRevenue = users.reduce(
      (sum, u) => sum + u.payments.reduce((s, p) => s + (p.amount ?? 0), 0),
      0,
    );
    const totalPayments = users.reduce((s, u) => s + u.payments.length, 0);
    return { total, premium, trial, totalRevenue, totalPayments };
  }, [users, now]);

  /* All payments flat list */
  const allPayments = useMemo(() => {
    return users
      .flatMap((u) => u.payments.map((p) => ({ ...p, uid: u.uid })))
      .sort(
        (a, b) =>
          new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
      );
  }, [users]);

  /* Filtered users */
  const filteredUsers = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter((u) => u.uid.toLowerCase().includes(q));
  }, [users, search]);

  /* Filtered payments */
  const filteredPayments = useMemo(() => {
    if (!search) return allPayments;
    const q = search.toLowerCase();
    return allPayments.filter(
      (p) =>
        p.uid.toLowerCase().includes(q) ||
        (p.paymentId && p.paymentId.toLowerCase().includes(q)),
    );
  }, [allPayments, search]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <div className="flex items-center gap-3 text-slate-400">
          <svg
            className="h-5 w-5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Loading data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] px-4">
        <div className="max-w-md w-full bg-slate-800/60 border border-red-500/30 rounded-2xl p-8 text-center space-y-4">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={fetchData}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'users', label: `Users (${stats.total})` },
    { key: 'payments', label: `Payments (${stats.totalPayments})` },
  ];

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 py-4">
          <h1 className="text-lg font-semibold tracking-tight">
            <span className="text-indigo-400">UniTrack</span> Admin
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
            >
              Refresh
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem('admin_auth');
                window.location.reload();
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-red-400 hover:border-red-500/40 focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        {/* Tabs */}
        <nav className="flex gap-1 rounded-lg bg-slate-800/50 border border-slate-700 p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium cursor-pointer ${
                tab === t.key
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Search (visible on users / payments tab) */}
        {tab !== 'overview' && (
          <div>
            <label htmlFor="search" className="sr-only">
              Search
            </label>
            <input
              id="search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                tab === 'users'
                  ? 'Search by user ID...'
                  : 'Search by user ID or payment ID...'
              }
              className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-800/60 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
          </div>
        )}

        {/* ---- Overview Tab ---- */}
        {tab === 'overview' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Users" value={stats.total} />
            <StatCard
              label="Premium Users"
              value={stats.premium}
              sub={`${stats.total ? ((stats.premium / stats.total) * 100).toFixed(1) : 0}% of total`}
            />
            <StatCard
              label="Trial Users"
              value={stats.trial}
              sub={`${stats.total ? ((stats.trial / stats.total) * 100).toFixed(1) : 0}% of total`}
            />
            <StatCard
              label="Total Revenue"
              value={fmtCurrency(stats.totalRevenue)}
              sub={`${stats.totalPayments} payments`}
            />
          </div>
        )}

        {/* ---- Users Tab ---- */}
        {tab === 'users' && (
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">UID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Premium Until</th>
                  <th className="px-4 py-3">Trial Ends</th>
                  <th className="px-4 py-3 text-right">Refreshes</th>
                  <th className="px-4 py-3 text-right">Payments</th>
                  <th className="px-4 py-3">Last Synced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const status = premiumLabel(u);
                    return (
                      <tr
                        key={u.uid}
                        className="hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-slate-300 max-w-[180px] truncate">
                          {u.uid}
                        </td>
                        <td className={`px-4 py-3 font-medium ${status.color}`}>
                          {status.text}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {fmtDate(u.premiumUntil)}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {fmtDate(u.trialEndsAt)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">
                          {u.refreshCount}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">
                          {u.payments.length}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {fmtDate(u.lastSynced || null)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ---- Payments Tab ---- */}
        {tab === 'payments' && (
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">User ID</th>
                  <th className="px-4 py-3">Payment ID</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Premium Until</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      No payments found
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p, i) => (
                    <tr
                      key={`${p.uid}-${p.paymentId}-${i}`}
                      className="hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-300 max-w-[180px] truncate">
                        {p.uid}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">
                        {p.paymentId || '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-400">
                        {fmtCurrency(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {fmtDate(p.paidAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {fmtDate(p.premiumUntil)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page Entry                                                         */
/* ------------------------------------------------------------------ */

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') === '1') {
      setAuthed(true);
    }
  }, []);

  if (!authed) {
    return <PasswordGate onAuth={() => setAuthed(true)} />;
  }

  return <Dashboard />;
}

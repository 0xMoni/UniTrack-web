'use client';

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-white dark:bg-slate-800/50 rounded-2xl p-5 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
      <div className="h-3 rounded bg-slate-200 dark:bg-slate-700 w-full mb-3" />
      <div className="h-3 rounded bg-slate-200 dark:bg-slate-700 w-4/5" />
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="animate-pulse bg-white dark:bg-slate-800/50 rounded-2xl p-5">
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-8 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-2/3 mx-auto rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-5">
      <SkeletonCard />
      <SkeletonStats />
      <div className="grid gap-3">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

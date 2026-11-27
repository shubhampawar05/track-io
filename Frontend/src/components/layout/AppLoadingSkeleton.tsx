"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export function AppLoadingSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`min-h-screen bg-(--bg) flex flex-col items-center justify-center gap-6 px-6 ${className}`.trim()}
      aria-busy
      aria-label="Loading"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="w-full max-w-xs space-y-2">
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-2 w-[80%] rounded-full" />
      </div>
    </div>
  );
}

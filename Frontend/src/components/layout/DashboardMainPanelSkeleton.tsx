"use client";

import { Skeleton } from "@/components/ui/Skeleton";

/** Placeholder for the main column while a dashboard route loads (sidebar is already from DashboardShell). */
export function DashboardMainPanelSkeleton() {
  return (
    <div
      className="flex-1 flex flex-col min-w-0 min-h-screen w-full bg-(--bg)"
      aria-busy
      aria-label="Loading page"
    >
      <div className="h-14 border-b border-(--border) flex items-center px-6 gap-4 shrink-0">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-24 ml-auto" />
      </div>
      <div className="flex-1 p-6 space-y-4 min-h-0">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

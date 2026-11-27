"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export function IssuesListSkeleton({ embedded }: { embedded?: boolean }) {
  const shell = embedded ? "w-full space-y-8" : "w-full p-6 space-y-8";
  return (
    <div className={shell} aria-busy aria-label="Loading issues">
      <div>
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        <div className="flex items-center gap-4 border-b border-(--border) pb-2 mb-6">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-3 w-28" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="linear-card p-4 flex items-center gap-4">
              <Skeleton className="h-4 w-4 rounded shrink-0" />
              <Skeleton className="h-4 flex-1 max-w-md" />
              <Skeleton className="h-5 w-16 rounded-full shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

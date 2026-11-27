"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export function ProjectsGridSkeleton() {
  return (
    <div className="p-8 space-y-8 w-full" aria-busy aria-label="Loading projects">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="linear-card p-6 space-y-6">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
              <div className="space-y-2 flex-1 min-w-0">
                <Skeleton className="h-5 w-40 max-w-[60%]" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

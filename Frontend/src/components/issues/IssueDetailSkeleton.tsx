"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export function IssueDetailSkeleton() {
  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-(--bg)"
      aria-busy
      aria-label="Loading issue"
    >
      <div className="shrink-0 px-6 pt-8 sm:px-8">
        <div className="flex w-full min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
            <Skeleton className="h-4 w-24 shrink-0" />
            <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-8 px-6 pb-16 pt-6 sm:px-8 lg:flex-row">
        <div className="custom-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto lg:min-h-0">
          <div className="space-y-8">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full max-w-3xl" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-8 w-28 rounded-full" />
              </div>
            </div>
            <div className="-mx-6 flex gap-2 sm:-mx-8">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-9 w-24 rounded-md" />
              ))}
            </div>
            <div className="space-y-10">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-36 w-full rounded-xl linear-card" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-16 w-full linear-card" />
                <Skeleton className="h-16 w-full linear-card" />
              </div>
            </div>
          </div>
        </div>
        <div className="custom-scrollbar min-h-0 w-full shrink-0 space-y-6 overflow-y-auto lg:w-80 lg:max-w-[20rem]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 rounded-xl border border-(--border) p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

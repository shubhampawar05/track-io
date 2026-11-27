"use client";

import { Skeleton } from "@/components/ui/Skeleton";

function ColumnSkeleton() {
  return (
    <div className="w-80 min-w-[320px] flex flex-col gap-3 shrink-0">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-6 rounded-md" />
      </div>
      <div className="flex-1 space-y-2 rounded-xl border border-(--border) bg-white/2 p-2 min-h-[200px]">
        <Skeleton className="h-[72px] w-full rounded-lg" />
        <Skeleton className="h-[72px] w-full rounded-lg" />
        <Skeleton className="h-[72px] w-full rounded-lg" />
      </div>
    </div>
  );
}

export function IssuesBoardSkeleton({
  className = "h-[calc(100vh-3.5rem)]",
}: {
  className?: string;
}) {
  return (
    <div
      className={`flex w-full min-w-0 gap-6 p-6 overflow-x-auto custom-scrollbar ${className}`.trim()}
      aria-busy
      aria-label="Loading board"
    >
      <ColumnSkeleton />
      <ColumnSkeleton />
      <ColumnSkeleton />
      <ColumnSkeleton />
    </div>
  );
}

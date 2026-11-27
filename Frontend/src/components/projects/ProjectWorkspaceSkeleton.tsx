"use client";

import { IssuesBoardSkeleton } from "@/components/issues/IssuesBoardSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

export function ProjectWorkspaceSkeleton() {
  return (
    <div className="flex-1 flex flex-col h-full min-h-0 w-full overflow-hidden" aria-busy aria-label="Loading project">
      <div className="h-14 border-b border-(--border) flex items-center justify-between px-6 bg-(--bg)/80 shrink-0 gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <Skeleton className="h-4 w-16" />
          <div className="h-4 w-px bg-(--border) shrink-0" />
          <Skeleton className="w-5 h-5 rounded-md shrink-0" />
          <Skeleton className="h-4 w-32 max-w-[40%]" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <IssuesBoardSkeleton className="h-full min-h-[280px]" />
      </div>
    </div>
  );
}

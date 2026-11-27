"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export function SettingsPreferencesSkeleton() {
  return (
    <div className="space-y-8" aria-busy aria-label="Loading preferences">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between p-4 linear-card gap-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <Skeleton className="h-5 w-10 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TableRowSkeleton({ showBorder }: { showBorder?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between p-4 gap-4 ${showBorder ? "border-b border-(--border)" : ""}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
        <div className="space-y-2 min-w-0 flex-1">
          <Skeleton className="h-4 w-40 max-w-full" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
      </div>
      <Skeleton className="h-4 w-14 shrink-0" />
    </div>
  );
}

export function SettingsInvitesListSkeleton() {
  return (
    <div className="linear-card overflow-hidden" aria-busy aria-label="Loading invitations">
      <TableRowSkeleton showBorder />
      <TableRowSkeleton showBorder />
    </div>
  );
}

export function SettingsMembersTableSkeleton() {
  return (
    <div className="linear-card overflow-hidden" aria-busy aria-label="Loading members">
      {[1, 2, 3, 4].map((i) => (
        <TableRowSkeleton key={i} showBorder={i !== 4} />
      ))}
    </div>
  );
}

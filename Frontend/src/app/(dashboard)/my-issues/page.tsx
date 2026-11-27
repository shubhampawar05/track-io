"use client";

import { ListView } from "@/components/issues/ListView";
import { useIssuesList } from "@/hooks/useIssuesList";

export default function MyIssuesPage() {
  const { issues: mine, loading, isError, error, refetch } = useIssuesList(null, { assignedToMe: true });

  return (
    <div className="p-8 flex flex-col gap-6 min-h-0">
      <h2 className="text-3xl font-semibold">My Issues</h2>
      <ListView
        issues={mine}
        loading={loading}
        error={isError ? error : null}
        onRetry={() => void refetch()}
        embedded
        issueNavFrom="list"
      />
    </div>
  );
}

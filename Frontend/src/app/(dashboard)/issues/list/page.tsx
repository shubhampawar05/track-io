"use client";

import { ListView } from "@/components/issues/ListView";
import { useIssuesList } from "@/hooks/useIssuesList";

export default function IssuesListPage() {
  const { issues, loading, isError, error, refetch, appliedPipelineFilters } = useIssuesList(null, {
    applyPipelineFilters: true,
  });
  return (
    <ListView
      issues={issues}
      loading={loading}
      error={isError ? error : null}
      onRetry={() => void refetch()}
      appliedPipelineFilters={appliedPipelineFilters}
      issueNavFrom="list"
    />
  );
}

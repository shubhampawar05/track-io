"use client";

import { ListView } from "@/components/issues/ListView";
import { useIssuesList } from "@/hooks/useIssuesList";

export default function IssuesListPage() {
  const { issues, loading, appliedPipelineFilters } = useIssuesList(null, {
    applyPipelineFilters: true,
  });
  return (
    <ListView
      issues={issues}
      loading={loading}
      appliedPipelineFilters={appliedPipelineFilters}
      issueNavFrom="list"
    />
  );
}

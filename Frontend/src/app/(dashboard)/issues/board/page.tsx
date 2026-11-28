"use client";

import { BoardView } from "@/components/issues/BoardView";
import { useIssuesList } from "@/hooks/useIssuesList";

export default function IssuesBoardPage() {
  const { issues, loading, isError, error, refetch, reorderBoard, appliedPipelineFilters } = useIssuesList(null, {
    applyPipelineFilters: true,
  });
  return (
    <BoardView
      issues={issues}
      loading={loading}
      error={isError ? error : null}
      onRetry={() => void refetch()}
      boardScope="__global__"
      issueNavFrom="board"
      appliedPipelineFilters={appliedPipelineFilters}
      onBoardReorder={(update) => reorderBoard(update)}
    />
  );
}

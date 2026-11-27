"use client";

import { BoardView } from "@/components/issues/BoardView";
import { useIssuesList } from "@/hooks/useIssuesList";

export default function IssuesBoardPage() {
  const { issues, loading, reorderBoard, appliedPipelineFilters } = useIssuesList(null, {
    applyPipelineFilters: true,
  });
  return (
    <BoardView
      issues={issues}
      loading={loading}
      boardScope="__global__"
      issueNavFrom="board"
      appliedPipelineFilters={appliedPipelineFilters}
      onBoardReorder={(updates) => reorderBoard(updates)}
    />
  );
}

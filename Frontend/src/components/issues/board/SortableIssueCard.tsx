"use client";

import type { CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDndContext } from "@dnd-kit/core";
import { IssueCard } from "@/components/issues/IssueCard";
import type { Issue } from "@/types/issue";

export function SortableIssueCard({
  issue,
  containerId,
  isLastOpened,
  onNavigate,
}: {
  issue: Issue;
  containerId: string;
  isLastOpened: boolean;
  onNavigate: () => void;
}) {
  const { active } = useDndContext();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    data: { sortable: { containerId } },
  });

  const isOverlaySource = active?.id === issue.id;
  const style: CSSProperties = {
    transform: isOverlaySource ? undefined : CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="touch-none" {...listeners} {...attributes}>
      <IssueCard issue={issue} isLastOpened={isLastOpened} onClick={onNavigate} />
    </div>
  );
}

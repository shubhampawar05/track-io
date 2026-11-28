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
    // The sortable wrapper is the card's single focusable element (dnd-kit sets role="button").
    // Enter opens the issue; Space (via the keyboard sensor) picks it up to drag.
    <div
      ref={setNodeRef}
      style={style}
      className="touch-none"
      {...listeners}
      {...attributes}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !active) {
          e.preventDefault();
          onNavigate();
          return;
        }
        listeners?.onKeyDown?.(e);
      }}
    >
      <IssueCard
        issue={issue}
        isLastOpened={isLastOpened}
        onClick={onNavigate}
        interactive={false}
      />
    </div>
  );
}

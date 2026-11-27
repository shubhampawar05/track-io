"use client";

import { useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AlertCircle, CheckCircle2, Circle, Clock, MoreHorizontal, Plus } from "lucide-react";
import { SortableIssueCard } from "@/components/issues/board/SortableIssueCard";
import type { Issue, Status } from "@/types/issue";
import type { BoardColumnConfig } from "@/lib/board-columns-storage";

export function BoardColumn({
  col,
  itemIds,
  issueMap,
  lastOpenedId,
  onIssueNavigate,
  onNewIssue,
  canManageColumn,
  onRenameColumn,
  onRemoveColumn,
}: {
  col: BoardColumnConfig;
  itemIds: string[];
  issueMap: Map<string, Issue>;
  lastOpenedId: string | null;
  onIssueNavigate: (issue: Issue) => void;
  onNewIssue?: () => void;
  canManageColumn: boolean;
  onRenameColumn: () => void;
  onRemoveColumn: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.status });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const iconForStatus = (status: Status) => {
    if (status === "todo") return <Circle className="w-4 h-4 text-linear-text-muted" />;
    if (status === "in-progress") return <Clock className="w-4 h-4 text-yellow-500" />;
    if (status === "done") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (status === "backlog") return <AlertCircle className="w-4 h-4 text-linear-text-muted" />;
    return <Circle className="w-4 h-4 text-linear-text-muted" />;
  };

  return (
    <div className="flex flex-col gap-4 w-80 min-w-[320px]">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2 min-w-0">
          {iconForStatus(col.status)}
          <span className="text-sm font-medium truncate">{col.title}</span>
          <span className="text-xs text-linear-text-muted shrink-0">{itemIds.length}</span>
        </div>
        {canManageColumn ? (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="p-1 rounded-md text-linear-text-muted hover:bg-(--hover) hover:text-(--text) transition-colors duration-200"
              aria-label="Column options"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] py-1 rounded-lg border border-(--border) bg-card shadow-xl">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-(--hover) hover:text-(--text)"
                  onClick={() => {
                    setMenuOpen(false);
                    onRenameColumn();
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-xs text-red-400 transition-colors hover:bg-(--hover)"
                  onClick={() => {
                    setMenuOpen(false);
                    onRemoveColumn();
                  }}
                >
                  Remove column
                </button>
              </div>
            )}
          </div>
        ) : (
          <span className="w-7 shrink-0" aria-hidden />
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-3 overflow-y-auto custom-scrollbar py-3 pr-2 min-h-[120px] rounded-lg transition-colors duration-200 ${
          isOver ? "bg-linear-accent/5 ring-1 ring-linear-accent/30" : ""
        }`}
      >
        <SortableContext id={col.status} items={itemIds} strategy={verticalListSortingStrategy}>
          {itemIds.map((id) => {
            const issue = issueMap.get(id);
            if (!issue) return null;
            return (
              <SortableIssueCard
                key={id}
                issue={issue}
                containerId={col.status}
                isLastOpened={lastOpenedId === issue.id}
                onNavigate={() => onIssueNavigate(issue)}
              />
            );
          })}
        </SortableContext>
        <button
          type="button"
          onClick={onNewIssue}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed border-[#3a3a4a] text-sm font-medium text-[#6b7280] transition-all duration-150 ease-out hover:border-(--primary) hover:bg-[color-mix(in_srgb,var(--primary)_6%,transparent)] hover:text-(--primary)"
        >
          <Plus className="h-[14px] w-[14px] shrink-0" strokeWidth={2} />
          New Issue
        </button>
      </div>
    </div>
  );
}

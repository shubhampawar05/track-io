"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, UserX, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOrganizationMembersQuery } from "@/hooks/useOrganizationRosterQueries";
import { PriorityMenuGlyph } from "@/components/issues/PriorityMenuGlyph";
import { StatusMenuGlyph } from "@/components/issues/StatusMenuGlyph";
import { apiJson } from "@/lib/api-client";
import {
  FALLBACK_ISSUE_STATUS_OPTIONS,
  statusSelectOptionsFromBoardColumns,
} from "@/lib/issue-status-ui";
import { orgIssuesQueryOptions } from "@/lib/query-org-sync";
import { useOrganizationStore } from "@/stores/useOrganizationStore";
import type { BoardColumnDto } from "@/types/issue";
import { ISSUE_LABEL_OPTIONS } from "@/utils/issueLabels";
import {
  applyPipelineDraft,
  clearPipelineFilters,
  syncPipelineDraftFromApplied,
  togglePipelineDraftKey,
  usePipelineFilterStore,
} from "@/hooks/useIssuesList";

const PRIORITY_ROWS: { value: string; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "none", label: "No Priority" },
];

const LABEL_DOT: Record<string, string> = {
  General: "#6b7280",
  Bug: "#ef4444",
  Feature: "#22c55e",
  Improvement: "#3b82f6",
  Docs: "#a855f7",
  Chore: "#eab308",
};

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

function avatarStyle(seed: string): CSSProperties {
  return { backgroundColor: `hsl(${hashHue(seed)} 55% 42%)` };
}

export function FilterPanelScrollContent({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const issuesBoardColsQuery = useQuery({
    queryKey: ["issuesBoardColumns", organizationId],
    enabled: Boolean(isOpen && organizationId),
    queryFn: async ({ queryKey }) => {
      const r = await apiJson<{ columns: BoardColumnDto[] }>(
        "/api/organizations/issues-board-columns",
        { orgId: queryKey[1] },
      );
      if (!r.success) throw new Error(r.error);
      return r.data.columns;
    },
    ...orgIssuesQueryOptions(),
  });

  const statusRows = useMemo(() => {
    const fromBoard = statusSelectOptionsFromBoardColumns(
      issuesBoardColsQuery.data,
    );
    if (fromBoard?.length) {
      return fromBoard.map((o) => ({ value: o.value, label: o.label }));
    }
    return FALLBACK_ISSUE_STATUS_OPTIONS.map((o) => ({
      value: o.value,
      label: o.label,
    }));
  }, [issuesBoardColsQuery.data]);

  const { draft } = usePipelineFilterStore();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const currentUserInitials = useAuthStore((s) => s.user?.initials ?? "");
  const { data: membersRes } = useOrganizationMembersQuery();
  const members = useMemo(
    () => (membersRes?.success ? membersRes.data : []),
    [membersRes],
  );

  useEffect(() => {
    if (isOpen) syncPipelineDraftFromApplied();
  }, [isOpen]);

  const assigneeRows = useMemo(() => {
    const meId = currentUserId;
    const rest = members
      .filter((m) => (meId ? m.userId !== meId : true))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    const rows: {
      value: string;
      label: string;
      kind: "me" | "member" | "unassigned";
      seed: string;
      initials: string;
    }[] = [];
    if (meId) {
      rows.push({
        value: "me",
        label: "Me",
        kind: "me",
        seed: meId,
        initials: "",
      });
    }
    for (const m of rest) {
      rows.push({
        value: m.userId,
        label: m.name,
        kind: "member",
        seed: m.userId,
        initials: m.initials,
      });
    }
    rows.push({
      value: "unassigned",
      label: "Unassigned",
      kind: "unassigned",
      seed: "unassigned",
      initials: "",
    });
    return rows;
  }, [members, currentUserId]);

  const onApply = () => {
    applyPipelineDraft();
    onClose();
  };

  const onClearAll = () => {
    clearPipelineFilters();
  };

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex shrink-0 items-center justify-between border-b border-border pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="size-[14px] text-muted-foreground shrink-0" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Filters
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close filters"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 -mr-1 space-y-5">
        <section>
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
            Status
          </h4>
          <div className="space-y-0">
            {statusRows.map((row) => {
              const checked = draft.status.includes(row.value);
              return (
                <button
                  key={row.value}
                  type="button"
                  onClick={() => togglePipelineDraftKey("status", row.value)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1 h-7 text-left hover:bg-accent"
                >
                  <Checkbox checked={checked} readOnly className="pointer-events-none" />
                  <StatusMenuGlyph
                    status={row.value}
                    className="size-3.5 shrink-0"
                  />
                  <span className="text-sm text-foreground">{row.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
            Priority
          </h4>
          <div className="space-y-0">
            {PRIORITY_ROWS.map((row) => {
              const checked = draft.priority.includes(row.value);
              return (
                <button
                  key={row.value}
                  type="button"
                  onClick={() => togglePipelineDraftKey("priority", row.value)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1 h-7 text-left hover:bg-accent"
                >
                  <Checkbox checked={checked} readOnly className="pointer-events-none" />
                  <PriorityMenuGlyph
                    priority={row.value}
                    className="size-3.5 shrink-0"
                  />
                  <span className="text-sm text-foreground">{row.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
            Labels
          </h4>
          <div className="space-y-0">
            {ISSUE_LABEL_OPTIONS.map((row) => {
              const checked = draft.label.includes(row.value);
              return (
                <button
                  key={row.value}
                  type="button"
                  onClick={() => togglePipelineDraftKey("label", row.value)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1 h-7 text-left hover:bg-accent"
                >
                  <Checkbox checked={checked} readOnly className="pointer-events-none" />
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: LABEL_DOT[row.value] ?? "#6b7280" }}
                    aria-hidden
                  />
                  <span className="text-sm text-foreground">{row.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
            Assignee
          </h4>
          <div className="space-y-0">
            {assigneeRows.map((row) => {
              const checked = draft.assignee.includes(row.value);
              return (
                <button
                  key={row.value}
                  type="button"
                  onClick={() => togglePipelineDraftKey("assignee", row.value)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1 h-7 text-left hover:bg-accent"
                >
                  <Checkbox checked={checked} readOnly className="pointer-events-none" />
                  {row.kind === "unassigned" ? (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <UserX className="size-3" aria-hidden />
                    </span>
                  ) : (
                    <span
                      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-medium text-white border border-border"
                      style={avatarStyle(row.seed)}
                      aria-hidden
                    >
                      {row.kind === "me"
                        ? (currentUserInitials || "M").slice(0, 2).toUpperCase()
                        : (row.initials ||
                            row.label
                              .split(/\s+/)
                              .map((w) => w[0])
                              .join("")
                          )
                            .slice(0, 2)
                            .toUpperCase()}
                    </span>
                  )}
                  <span className="text-sm text-foreground">{row.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="mt-auto shrink-0 border-t border-border pt-3 flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onClearAll}>
          Clear All
        </Button>
        <Button type="button" variant="default" className="flex-1" onClick={onApply}>
          Apply
        </Button>
      </div>
    </div>
  );
}

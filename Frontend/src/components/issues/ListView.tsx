"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Circle,
  ListFilter,
  Plus,
  Tag,
  User,
  X,
  Zap,
} from "lucide-react";
import { useUIStore } from "@/stores/useUIStore";
import type { Issue } from "@/types/issue";
import { IssuesListSkeleton } from "@/components/issues/IssuesListSkeleton";
import { QueryErrorState } from "@/components/ui/QueryErrorState";
import { buildIssueDetailUrl } from "@/lib/issue-detail-from";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOrganizationMembersQuery } from "@/hooks/useOrganizationRosterQueries";
import {
  clearPipelineFilters,
  formatAssigneeFilterChipLabel,
  removeAppliedPipelineFilterValue,
  type PipelineFilterState,
} from "@/hooks/useIssuesList";
import {
  formatIssueStatusLabel,
  sortIssueStatusSlugs,
} from "@/lib/issue-status-ui";
import { PriorityMenuGlyph } from "@/components/issues/PriorityMenuGlyph";
import { StatusMenuGlyph } from "@/components/issues/StatusMenuGlyph";
import { listRowAssigneeTooltip } from "@/utils/issuePriority";

export type ListPipelineTab = "all" | "active" | "backlog" | "priority";

/** Per the frontend spec, the Active tab shows `todo` + `in-progress` only. */
const ACTIVE_STATUSES = new Set(["todo", "in-progress"]);

function priorityRank(p: string): number {
  const order: Record<string, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return order[p] ?? 99;
}

function filterByTab(issues: Issue[], tab: ListPipelineTab): Issue[] {
  if (tab === "all") return issues;
  if (tab === "active") {
    return issues.filter((i) => ACTIVE_STATUSES.has(i.status));
  }
  if (tab === "backlog") {
    return issues.filter((i) => i.status === "backlog");
  }
  if (tab === "priority") {
    return [...issues].sort(
      (a, b) => priorityRank(a.priority) - priorityRank(b.priority),
    );
  }
  return issues;
}

function tabLabel(tab: ListPipelineTab): string {
  switch (tab) {
    case "all":
      return "All Issues";
    case "active":
      return "Active";
    case "backlog":
      return "Backlog";
    case "priority":
      return "Priority";
    default:
      return "";
  }
}

function emptyMessage(tab: ListPipelineTab): string {
  switch (tab) {
    case "all":
      return "No issues yet.";
    case "active":
      return "No active issues (nothing is in Todo or In Progress).";
    case "backlog":
      return "No backlog issues yet.";
    case "priority":
      return "No issues to sort.";
    default:
      return "No issues.";
  }
}

export function ListView({
  issues,
  loading,
  error,
  onRetry,
  projectSlug,
  embedded,
  hideFilters = false,
  issueNavFrom = "list",
  issueNavProjectView = "list",
  appliedPipelineFilters,
}: {
  issues: Issue[];
  loading?: boolean;
  /** Load failure for `issues`; renders an error state instead of the empty state. */
  error?: unknown;
  onRetry?: () => void;
  /** When set, empty-state “New issue” opens the modal scoped to this project. */
  projectSlug?: string | null;
  embedded?: boolean;
  /** Hide the Filters button when pipeline filters don't apply to this list (e.g. My Issues). */
  hideFilters?: boolean;
  issueNavFrom?: "board" | "list" | "project";
  issueNavProjectView?: "list" | "board";
  appliedPipelineFilters?: PipelineFilterState;
}) {
  const router = useRouter();
  const setFilterOpen = useUIStore((s) => s.setFilterOpen);
  const openNewIssueModal = useUIStore((s) => s.openNewIssueModal);
  const [tab, setTab] = useState<ListPipelineTab>("all");

  const filtered = useMemo(() => filterByTab(issues, tab), [issues, tab]);

  const issueDetailUrl = (issueId: string) =>
    buildIssueDetailUrl(issueId, {
      from: projectSlug ? "project" : issueNavFrom,
      projectSlug: projectSlug ?? undefined,
      projectView: projectSlug ? issueNavProjectView : undefined,
    });

  const statusGroups = useMemo(() => {
    if (tab === "priority") return [];
    const present = new Set<string>();
    for (const i of filtered) present.add(i.status);
    return sortIssueStatusSlugs(present);
  }, [filtered, tab]);

  const shell = embedded ? "w-full space-y-8" : "w-full p-6 space-y-8";

  if (loading) {
    return <IssuesListSkeleton embedded={embedded} />;
  }

  const tabs: ListPipelineTab[] = ["all", "active", "backlog", "priority"];

  return (
    <div className={shell}>
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Issue Pipeline</h2>
          {hideFilters ? null : (
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-(--border) rounded-md text-xs text-linear-text-muted hover:text-(--text) transition-all duration-200 mr-[6px]"
            >
              <ListFilter className="w-3.5 h-3.5" />
              Filters
            </button>
          )}
        </div>
        {!embedded && appliedPipelineFilters ? (
          <IssuePipelineFilterChipsRow applied={appliedPipelineFilters} />
        ) : null}
        <div
          className="flex items-center gap-4 text-sm text-linear-text-muted pb-2"
          role="tablist"
          aria-label="Issue pipeline"
        >
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`pb-2 px-2 cursor-pointer transition-colors duration-200 border-b-2 -mb-px ${
                tab === t
                  ? "text-(--text) border-linear-accent"
                  : "border-transparent hover:text-(--text)"
              }`}
            >
              {tabLabel(t)}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <QueryErrorState message="Could not load issues." error={error} onRetry={onRetry} />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-(--border) p-10 text-center space-y-4">
          <p className="text-sm text-linear-text-muted">{emptyMessage(tab)}</p>
          <button
            type="button"
            onClick={() => openNewIssueModal(projectSlug ?? null)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-linear-accent text-primary-foreground text-sm font-medium hover:brightness-110 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            New issue
          </button>
        </div>
      ) : tab === "priority" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Zap className="w-3.5 h-3.5 text-linear-text-muted" />
            <span className="text-xs font-bold uppercase tracking-widest">
              By priority
            </span>
            <span className="text-xs text-linear-text-muted">
              {filtered.length}
            </span>
          </div>
          <div className="linear-card">
            {filtered.map((issue, idx) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                idx={idx}
                total={filtered.length}
                onOpen={() => router.push(issueDetailUrl(issue.id))}
              />
            ))}
          </div>
        </div>
      ) : (
        statusGroups.map((status) => {
          const groupIssues = filtered.filter((i) => i.status === status);
          if (groupIssues.length === 0) return null;
          return (
            <div key={status} className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <StatusMenuGlyph
                  status={status}
                  className="size-3.5 shrink-0"
                />
                <span className="text-xs font-bold uppercase tracking-widest">
                  {formatIssueStatusLabel(status)}
                </span>
                <span className="text-xs text-linear-text-muted">
                  {groupIssues.length}
                </span>
              </div>
              <div className="linear-card">
                {groupIssues.map((issue, idx) => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    idx={idx}
                    total={groupIssues.length}
                    onOpen={() => router.push(issueDetailUrl(issue.id))}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

const STATUS_CHIP_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "Todo",
  "in-progress": "In Progress",
  done: "Done",
  canceled: "Cancelled",
};

const PRIORITY_CHIP_LABEL: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No Priority",
};

export function IssuePipelineFilterChipsRow({
  applied,
}: {
  applied: PipelineFilterState;
}) {
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const { data: membersRes } = useOrganizationMembersQuery();
  const members = useMemo(
    () => (membersRes?.success ? membersRes.data : []),
    [membersRes],
  );
  const membersById = useMemo(
    () => new Map(members.map((m) => [m.userId, m.name] as const)),
    [members],
  );

  const chips = useMemo(() => {
    const out: {
      key: keyof PipelineFilterState;
      value: string;
      label: string;
      icon: "status" | "priority" | "label" | "assignee";
    }[] = [];
    for (const s of applied.status) {
      out.push({
        key: "status",
        value: s,
        label: STATUS_CHIP_LABEL[s] ?? formatIssueStatusLabel(s),
        icon: "status",
      });
    }
    for (const p of applied.priority) {
      out.push({
        key: "priority",
        value: p,
        label: PRIORITY_CHIP_LABEL[p] ?? p,
        icon: "priority",
      });
    }
    for (const l of applied.label) {
      out.push({ key: "label", value: l, label: l, icon: "label" });
    }
    for (const a of applied.assignee) {
      out.push({
        key: "assignee",
        value: a,
        label: formatAssigneeFilterChipLabel(a, membersById, currentUserId),
        icon: "assignee",
      });
    }
    return out;
  }, [applied, membersById, currentUserId]);

  const n = chips.length;
  if (n === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={`${c.key}-${c.value}`}
          type="button"
          onClick={() => removeAppliedPipelineFilterValue(c.key, c.value)}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-accent py-0.5 pl-2 pr-1 text-[11px] text-foreground"
        >
          {c.icon === "status" ? (
            <Circle
              className="size-2.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          ) : null}
          {c.icon === "priority" ? (
            <ArrowUp
              className="size-2.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          ) : null}
          {c.icon === "label" ? (
            <Tag
              className="size-2.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          ) : null}
          {c.icon === "assignee" ? (
            <User
              className="size-2.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          ) : null}
          <span className="truncate">{c.label}</span>
          <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-muted">
            <X className="size-3" aria-hidden />
          </span>
        </button>
      ))}
      {n >= 2 ? (
        <button
          type="button"
          onClick={() => clearPipelineFilters()}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}

function IssueRow({
  issue,
  idx,
  total,
  onOpen,
}: {
  issue: Issue;
  idx: number;
  total: number;
  onOpen: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen()}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={`flex items-center justify-between p-4 hover:bg-(--hover) transition-all duration-200 cursor-pointer ${
        idx !== total - 1 ? "border-b border-(--border)" : ""
      }`}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <span className="text-xs font-mono text-linear-text-muted w-16 shrink-0">
          {issue.key ?? issue.id}
        </span>
        <h4 className="text-sm font-medium truncate max-w-md">{issue.title}</h4>
      </div>
      <div className="flex items-center gap-6 shrink-0">
        <span className="px-2 py-0.5 bg-white/5 border border-(--border) rounded text-[10px] text-linear-text-muted">
          {issue.label}
        </span>
        <div className="group/priority relative flex w-20 items-center gap-1 text-[10px] text-linear-text-muted">
          <PriorityMenuGlyph
            priority={issue.priority}
            className="h-3.5 w-3.5 shrink-0 stroke-[2.25] text-linear-text-muted"
          />
          {issue?.priority.charAt(0).toUpperCase() + issue?.priority.slice(1)}
        </div>
        <div className="group/assignee relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-linear-text-muted dark:bg-transparent">
          <span
            className={`transition-transform duration-150 ease-out group-hover/assignee:scale-[1.25] border border-(--border) rounded-full p-1 ${listRowAssigneeTooltip(issue) === "Unassigned" ? "size-6 flex items-center justify-center" : ""}`}
          >
            {issue.assignee}
          </span>
          <span
            className="pointer-events-none absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md bg-[#111118] px-2 py-1 text-[10px] font-medium text-white/90 opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 ease-out group-hover/assignee:opacity-100"
            role="tooltip"
          >
            {listRowAssigneeTooltip(issue)}
          </span>
        </div>
        <span className="text-[10px] text-linear-text-muted w-16 text-right">
          {issue.date}
        </span>
      </div>
    </div>
  );
}

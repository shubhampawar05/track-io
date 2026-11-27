"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  Bell,
  Calendar as CalendarIcon,
  Tag,
  Trash2,
  User,
} from "lucide-react";
import { IssueDetailGithub } from "@/components/issues/detail/IssueDetailGithub";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiJson } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { resolveIssueCloseHref } from "@/lib/issue-detail-from";
import type {
  IssueDetail,
  Priority,
  ProjectDetail,
  ProjectMember,
  Status,
} from "@/types/issue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOrganizationStore } from "@/stores/useOrganizationStore";
import { useUIStore } from "@/stores/useUIStore";
import { PriorityMenuGlyph } from "@/components/issues/PriorityMenuGlyph";
import { StatusMenuGlyph } from "@/components/issues/StatusMenuGlyph";
import { ISSUE_LABEL_OPTIONS, normalizeIssueLabel } from "@/utils/issueLabels";
import {
  propertyRowClass,
  propertySelectContentClass,
  propertySelectItemClass,
} from "@/components/issues/detail/issueDetailPropertySelectStyles";

/** Same order as filter panel priority list. */
const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
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
  Chore: "#ca8a04",
};

function formatMetaDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function IssueDetailSidePanel({
  issue,
  onRefresh,
  statusSelectOptions,
}: {
  issue: IssueDetail;
  onRefresh: () => Promise<void>;
  statusSelectOptions: { value: Status; label: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const organizations = useAuthStore((s) => s.organizations);
  const showToast = useUIStore((s) => s.showToast);
  const [patching, setPatching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);

  const isOrgOwner = useMemo(() => {
    if (!organizationId) return false;
    return organizations.find((o) => o.id === organizationId)?.role === "owner";
  }, [organizationId, organizations]);

  const slug = issue.projectSlug || issue.projectId || "";

  const { data: projectApi } = useQuery({
    queryKey: ["project", organizationId, slug],
    enabled: Boolean(slug && organizationId),
    queryFn: async () =>
      apiJson<ProjectDetail>(`/api/projects/${encodeURIComponent(slug)}`),
  });

  const members = useMemo(
    () => (projectApi?.success ? projectApi.data.members : []),
    [projectApi],
  );

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setPatching(true);
      try {
        const r = await apiJson(`/api/issues/${encodeURIComponent(issue.id)}`, {
          method: "PATCH",
          body,
        });
        if (!r.success) {
          showToast(r.error, "error");
          return;
        }
        await onRefresh();
      } finally {
        setPatching(false);
      }
    },
    [issue.id, onRefresh, showToast],
  );

  const assigneeSelectMembers = useMemo(() => {
    const fromMembers: ProjectMember[] = [...members];
    const ids = new Set(fromMembers.map((m) => m.id));
    if (issue.assigneeId && !ids.has(issue.assigneeId)) {
      fromMembers.unshift({
        id: issue.assigneeId,
        name: issue.assigneeName ?? "Member",
        initials: issue.assigneeInitials ?? "?",
      });
    }
    return fromMembers;
  }, [members, issue.assigneeId, issue.assigneeName, issue.assigneeInitials]);

  const assigneeValue = issue.assigneeId ?? "";

  const assigneePreview = useMemo(() => {
    if (!issue.assigneeId) {
      return { initials: "—", name: "Unassigned" as string };
    }
    return {
      initials: issue.assigneeInitials ?? "?",
      name: issue.assigneeName ?? "Member",
    };
  }, [issue.assigneeId, issue.assigneeInitials, issue.assigneeName]);

  const labelValue = normalizeIssueLabel(issue.label);
  const labelOption = ISSUE_LABEL_OPTIONS.find((o) => o.value === labelValue);

  const dueDateParsed = useMemo(() => {
    if (!issue.dueDate) return undefined;
    const d = new Date(issue.dueDate);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }, [issue.dueDate]);

  const dueDateTriggerLabel = dueDateParsed
    ? format(dueDateParsed, "MMM d, yyyy")
    : "No due date";

  const runDeleteIssue = useCallback(() => {
    void (async () => {
      setDeleting(true);
      try {
        const r = await apiJson(`/api/issues/${encodeURIComponent(issue.id)}`, {
          method: "DELETE",
        });
        if (!r.success) {
          showToast(r.error, "error");
          return;
        }
        queryClient.removeQueries({
          queryKey: ["issue", organizationId, issue.id],
        });
        showToast("Issue deleted");
        router.push(resolveIssueCloseHref(searchParams));
        queueMicrotask(() => {
          if (organizationId) {
            void queryClient.invalidateQueries({
              queryKey: ["issues", organizationId],
              refetchType: "all",
            });
          }
          if (slug && organizationId) {
            void queryClient.invalidateQueries({
              queryKey: ["project", organizationId, slug],
            });
          }
        });
      } finally {
        setDeleting(false);
        setDeleteConfirmOpen(false);
      }
    })();
  }, [
    issue.id,
    organizationId,
    queryClient,
    router,
    searchParams,
    showToast,
    slug,
  ]);

  const subtaskCount = issue.subtasks?.length ?? 0;

  const statusLabel =
    statusSelectOptions.find((o) => o.value === issue.status)?.label ??
    String(issue.status);

  const priorityLabel =
    PRIORITY_OPTIONS.find((o) => o.value === issue.priority)?.label ??
    String(issue.priority);

  return (
    <div className="w-full min-w-0">
      <div className="space-y-6">
        <div
          className={`rounded-xl border border-white/[0.06] bg-white/[0.02] shadow-sm p-5`}
        >
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-linear-text-muted">
            Properties
          </h3>
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs text-linear-text-muted">Assignee</span>
              <Select
                modal={false}
                disabled={patching || !slug || !projectApi?.success}
                value={assigneeValue}
                onValueChange={(v) => {
                  void patch(
                    v === "" ? { assigneeId: null } : { assigneeId: v },
                  );
                }}
              >
                <SelectTrigger
                  aria-label="Assignee"
                  className={cn(
                    propertyRowClass,
                    "w-full min-w-0 py-0 pr-2 pl-2.5 shadow-none focus-visible:ring-0 [&_svg]:text-linear-text-muted dark:[&_svg]:text-[rgba(255,255,255,0.45)]",
                  )}
                >
                  {assigneePreview.name !== "Unassigned" ? (
                    <span className="flex min-w-0 flex-1 items-center gap-2 my-1">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,#5e6ad2_14%,transparent)] text-[10px] font-bold text-[var(--text)] ring-1 ring-[color-mix(in_srgb,#5e6ad2_35%,transparent)] dark:bg-[color-mix(in_srgb,#5e6ad2_14%,transparent)] dark:text-white dark:ring-[color-mix(in_srgb,#5e6ad2_35%,transparent)]">
                        {assigneePreview.initials}
                      </span>
                      <span className="truncate">{assigneePreview.name}</span>
                    </span>
                  ) : (
                    <span className="truncate text-linear-text-muted dark:text-[rgba(255,255,255,0.45)]">
                      Unassigned
                    </span>
                  )}
                  <SelectValue className="sr-only" />
                </SelectTrigger>
                <SelectContent
                  align="start"
                  side="bottom"
                  sideOffset={6}
                  className={propertySelectContentClass}
                >
                  {currentUserId ? (
                    <SelectItem
                      value={currentUserId}
                      className={propertySelectItemClass}
                    >
                      Assign to me
                    </SelectItem>
                  ) : null}
                  <SelectItem value="" className={propertySelectItemClass}>
                    Unassigned
                  </SelectItem>
                  {assigneeSelectMembers
                    .filter((m) =>
                      currentUserId ? m.id !== currentUserId : true,
                    )
                    .map((m) => (
                      <SelectItem
                        key={m.id}
                        value={m.id}
                        className={propertySelectItemClass}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,#5e6ad2_14%,transparent)] text-[10px] font-bold text-[var(--text)] ring-1 ring-[color-mix(in_srgb,#5e6ad2_35%,transparent)] dark:text-white">
                            {m.initials}
                          </span>
                          <span className="truncate">{m.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs text-linear-text-muted">Project</span>
              <Link
                href={`/projects/${encodeURIComponent(slug)}`}
                className="truncate text-sm font-medium text-violet-400 hover:text-violet-300 hover:underline"
              >
                {issue.projectName || slug || "—"}
              </Link>
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs text-linear-text-muted">Status</span>
              <Select
                modal={false}
                disabled={patching || statusSelectOptions.length === 0}
                value={statusSelectOptions.length === 0 ? null : issue.status}
                onValueChange={(v) => void patch({ status: v })}
              >
                <SelectTrigger
                  aria-label="Status"
                  className={cn(
                    propertyRowClass,
                    "w-full min-w-0 py-0 pr-2 pl-2.5 shadow-none focus-visible:ring-0 [&_svg]:text-linear-text-muted dark:[&_svg]:text-[rgba(255,255,255,0.45)]",
                  )}
                >
                  <StatusMenuGlyph
                    status={issue.status}
                    className="size-3.5 shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate text-left">
                    {statusLabel}
                  </span>
                  <SelectValue className="sr-only" />
                </SelectTrigger>
                <SelectContent
                  align="start"
                  side="bottom"
                  sideOffset={6}
                  className={propertySelectContentClass}
                >
                  {statusSelectOptions.length === 0
                    ? null
                    : statusSelectOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className={propertySelectItemClass}
                        >
                          <StatusMenuGlyph
                            status={option.value}
                            className="my-auto mr-1 size-3.5 shrink-0"
                          />
                          {option.label}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs text-linear-text-muted">Priority</span>
              <Select
                modal={false}
                disabled={patching}
                value={issue.priority}
                onValueChange={(v) => void patch({ priority: v })}
              >
                <SelectTrigger
                  aria-label="Priority"
                  className={cn(
                    propertyRowClass,
                    "w-full min-w-0 py-0 pr-2 pl-2.5 shadow-none focus-visible:ring-0 [&_svg]:text-linear-text-muted dark:[&_svg]:text-[rgba(255,255,255,0.45)]",
                  )}
                >
                  <PriorityMenuGlyph
                    priority={issue.priority}
                    className="size-3.5 shrink-0 text-linear-text-muted dark:text-[rgba(255,255,255,0.45)]"
                  />
                  <span className="min-w-0 flex-1 truncate text-left">
                    {priorityLabel}
                  </span>
                  <SelectValue className="sr-only" />
                </SelectTrigger>
                <SelectContent
                  align="start"
                  side="bottom"
                  sideOffset={6}
                  className={propertySelectContentClass}
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className={propertySelectItemClass}
                    >
                      <span className="flex items-center gap-2">
                        <PriorityMenuGlyph
                          priority={option.value}
                          className="my-auto size-3.5 shrink-0"
                        />
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs text-linear-text-muted">Due date</span>
              <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                <PopoverTrigger
                  type="button"
                  disabled={patching}
                  aria-label="Due date"
                  className={cn(
                    propertyRowClass,
                    "h-9 min-h-[36px] w-full cursor-pointer text-left text-[13px] shadow-none dark:bg-[rgba(255,255,255,0.04)] dark:text-white",
                    !dueDateParsed &&
                      "text-linear-text-muted dark:text-[rgba(255,255,255,0.35)]",
                  )}
                >
                  <CalendarIcon
                    className="size-[14px] shrink-0 text-linear-text-muted dark:text-[rgba(255,255,255,0.45)]"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {dueDateTriggerLabel}
                  </span>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className={cn(
                    "w-auto border border-[var(--border)] bg-[var(--card)] p-2 text-[var(--text)] shadow-lg ring-0",
                    "dark:border-[rgba(255,255,255,0.08)] dark:bg-[#1e1e2e] dark:text-white",
                  )}
                >
                  <Calendar
                    mode="single"
                    selected={dueDateParsed}
                    onSelect={(d) => {
                      const iso = d
                        ? new Date(
                            `${format(d, "yyyy-MM-dd")}T12:00:00`,
                          ).toISOString()
                        : null;
                      void patch(d ? { dueDate: iso } : { dueDate: null });
                      setDueDateOpen(false);
                    }}
                    className={cn(
                      "rounded-md bg-transparent p-0 text-[var(--text)] [--cell-size:2rem]",
                      "dark:text-white",
                      "[&_button[data-day]:hover]:bg-[var(--hover)] dark:[&_button[data-day]:hover]:bg-[rgba(255,255,255,0.06)]",
                    )}
                    classNames={{
                      outside:
                        "text-[var(--text-muted)] dark:text-[rgba(255,255,255,0.35)]",
                      disabled:
                        "text-[var(--text-muted)]/70 opacity-50 dark:text-[rgba(255,255,255,0.25)]",
                      hidden: "invisible",
                      weekday:
                        "flex-1 rounded-md text-[0.75rem] font-normal text-[var(--text-muted)] dark:text-[rgba(255,255,255,0.45)]",
                    }}
                    modifiersClassNames={{
                      selected:
                        "[&_button]:!bg-[#5e6ad2] [&_button]:!text-white",
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <div
          className={`rounded-xl border border-white/[0.06] bg-white/[0.02] shadow-sm p-5`}
        >
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-linear-text-muted">
            Labels
          </h3>
          <Select
            modal={false}
            disabled={patching}
            value={labelValue}
            onValueChange={(v) => void patch({ label: v })}
          >
            <SelectTrigger
              aria-label="Label"
              className={cn(
                propertyRowClass,
                "w-full min-w-0 py-0 pr-2 pl-2.5 shadow-none focus-visible:ring-0 [&_svg]:text-linear-text-muted dark:[&_svg]:text-[rgba(255,255,255,0.45)]",
              )}
            >
              <Tag className="size-4 shrink-0 text-linear-text-muted dark:text-[rgba(255,255,255,0.45)]" />
              <span
                className="size-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: LABEL_DOT[labelValue] ?? "#6b7280",
                }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-left">
                {labelOption?.label ?? labelValue}
              </span>
              <SelectValue className="sr-only" />
            </SelectTrigger>
            <SelectContent
              align="start"
              side="bottom"
              sideOffset={6}
              className={propertySelectContentClass}
            >
              {ISSUE_LABEL_OPTIONS.map((o) => (
                <SelectItem
                  key={o.value}
                  value={o.value}
                  className={propertySelectItemClass}
                >
                  <span
                    className="size-2 my-auto mr-1 shrink-0 rounded-full"
                    style={{
                      backgroundColor: LABEL_DOT[o.value] ?? "#6b7280",
                    }}
                    aria-hidden
                  />
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className={`rounded-xl border border-white/[0.06] bg-white/[0.02] shadow-sm p-5`}
        >
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-linear-text-muted">
            Metadata
          </h3>
          <div className="space-y-2.5 text-[11px] leading-snug">
            <div className="flex min-w-0 items-baseline justify-between gap-3">
              <span className="shrink-0 text-linear-text-muted text-[12px]">
                Created
              </span>
              <span className="min-w-0 truncate text-right text-[var(--text)]">
                {formatMetaDateTime(issue.createdAt)}
              </span>
            </div>
            <div className="flex min-w-0 items-baseline justify-between gap-3">
              <span className="shrink-0 text-linear-text-muted text-[12px]">
                Updated
              </span>
              <span className="min-w-0 truncate text-right text-[var(--text)]">
                {formatMetaDateTime(issue.updatedAt)}
              </span>
            </div>
            <div className="flex min-w-0 items-baseline justify-between gap-3">
              <span className="shrink-0 text-linear-text-muted text-[12px]">
                Identifier
              </span>
              <span className="min-w-0 truncate text-right font-mono text-[var(--text)]">
                {issue.key ?? issue.id}
              </span>
            </div>
          </div>
        </div>

        <IssueDetailGithub issue={issue} />

        {isOrgOwner ? (
          <button
            type="button"
            disabled={deleting || patching || subtaskCount > 0}
            onClick={() => setDeleteConfirmOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500 py-2 text-xs font-medium text-red-500 transition-colors hover:border-red-500 hover:bg-red-500/15 hover:text-red-500 disabled:opacity-50 dark:border-red-500 dark:text-red-500 dark:hover:bg-red-500/25 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {deleting ? "Deleting…" : "Delete issue"}
          </button>
        ) : null}

        {deleteConfirmOpen ? (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
            role="presentation"
            onClick={() => !deleting && setDeleteConfirmOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-issue-confirm-title"
              className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="delete-issue-confirm-title"
                className="text-sm font-semibold text-[var(--text)] mb-2"
              >
                Delete this issue?
              </h2>
              <p className="text-xs text-linear-text-muted leading-relaxed mb-6">
                Comments will be removed. This cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] text-linear-text-muted hover:bg-white/5 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={runDeleteIssue}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete permanently"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div
          className={`rounded-xl border border-white/[0.06] bg-white/[0.02] shadow-sm p-5`}
        >
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-linear-text-muted">
            Notifications
          </h3>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 text-xs font-medium text-linear-text-muted transition-colors hover:bg-white/[0.06] disabled:opacity-60"
            disabled
          >
            <Bell className="h-3.5 w-3.5" />
            Subscribe (soon)
          </button>
        </div>
      </div>
    </div>
  );
}

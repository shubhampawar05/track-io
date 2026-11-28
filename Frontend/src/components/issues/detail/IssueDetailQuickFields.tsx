"use client";

import { useCallback, useMemo, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { useProjectDetail } from "@/hooks/useProjectDetail";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriorityMenuGlyph } from "@/components/issues/PriorityMenuGlyph";
import { StatusMenuGlyph } from "@/components/issues/StatusMenuGlyph";
import {
  propertyRowClass,
  propertySelectContentClass,
  propertySelectItemClass,
} from "@/components/issues/detail/issueDetailPropertySelectStyles";
import type {
  IssueDetail,
  Priority,
  ProjectMember,
  Status,
} from "@/types/issue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useUIStore } from "@/stores/useUIStore";
import { cn } from "@/lib/utils";

/** Same order as filter panel priority list. */
const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "none", label: "No Priority" },
];

const quickFieldTriggerClass = cn(
  propertyRowClass,
  "inline-flex h-9 w-auto min-w-0 py-0 pr-2 pl-2.5 shadow-none focus-visible:ring-0 [&_svg]:text-linear-text-muted dark:[&_svg]:text-[rgba(255,255,255,0.45)]",
);

export function IssueDetailQuickFields({
  issue,
  onRefresh,
  statusSelectOptions,
}: {
  issue: IssueDetail;
  onRefresh: () => Promise<void>;
  statusSelectOptions: { value: Status; label: string }[];
}) {
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const showToast = useUIStore((s) => s.showToast);
  const [patching, setPatching] = useState(false);
  const slug = issue.projectSlug || issue.projectId || "";

  const { data: projectData } = useProjectDetail(slug);

  const members = useMemo(
    () => projectData?.members ?? [],
    [projectData],
  );
  /** Only project members can be assigned, so "Assign to me" is offered to members only. */
  const canAssignSelf = Boolean(
    currentUserId && members.some((m) => m.id === currentUserId),
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

  const statusLabel =
    statusSelectOptions.find((o) => o.value === issue.status)?.label ??
    String(issue.status);

  const priorityLabel =
    PRIORITY_OPTIONS.find((o) => o.value === issue.priority)?.label ??
    String(issue.priority);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        modal={false}
        disabled={patching || statusSelectOptions.length === 0}
        value={statusSelectOptions.length === 0 ? null : issue.status}
        onValueChange={(v) => void patch({ status: v })}
      >
        <SelectTrigger aria-label="Status" className={quickFieldTriggerClass}>
          <StatusMenuGlyph status={issue.status} className="size-3.5 shrink-0" />
          <span className="min-w-0 max-w-[12rem] truncate text-left">{statusLabel}</span>
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
            : statusSelectOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className={propertySelectItemClass}>
                  <StatusMenuGlyph status={o.value} className="my-auto mr-1 size-3.5 shrink-0" />
                  {o.label}
                </SelectItem>
              ))}
        </SelectContent>
      </Select>

      <Select
        modal={false}
        disabled={patching}
        value={issue.priority}
        onValueChange={(v) => void patch({ priority: v })}
      >
        <SelectTrigger aria-label="Priority" className={quickFieldTriggerClass}>
          <PriorityMenuGlyph
            priority={issue.priority}
            className="size-3.5 shrink-0 text-linear-text-muted dark:text-[rgba(255,255,255,0.45)]"
          />
          <span className="min-w-0 max-w-[10rem] truncate text-left">{priorityLabel}</span>
          <SelectValue className="sr-only" />
        </SelectTrigger>
        <SelectContent
          align="start"
          side="bottom"
          sideOffset={6}
          className={propertySelectContentClass}
        >
          {PRIORITY_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value} className={propertySelectItemClass}>
              <span className="flex items-center gap-2">
                <PriorityMenuGlyph priority={o.value} className="my-auto size-3.5 shrink-0" />
                {o.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        modal={false}
        disabled={patching || !slug || !projectData}
        value={assigneeValue}
        onValueChange={(v) => {
          void patch(v === "" ? { assigneeId: null } : { assigneeId: v });
        }}
      >
        <SelectTrigger
          aria-label="Assignee"
          className={cn(quickFieldTriggerClass, "max-w-[16rem]")}
        >
          {assigneePreview.name !== "Unassigned" ? (
            <span className="flex min-w-0 flex-1 items-center gap-2 my-1">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,#5e6ad2_14%,transparent)] text-[10px] font-bold text-[var(--text)] ring-1 ring-[color-mix(in_srgb,#5e6ad2_35%,transparent)] dark:bg-[color-mix(in_srgb,#5e6ad2_14%,transparent)] dark:text-white dark:ring-[color-mix(in_srgb,#5e6ad2_35%,transparent)]">
                {assigneePreview.initials}
              </span>
              <span className="min-w-0 truncate">{assigneePreview.name}</span>
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
          {canAssignSelf && currentUserId ? (
            <SelectItem value={currentUserId} className={propertySelectItemClass}>
              Assign to me
            </SelectItem>
          ) : null}
          <SelectItem value="" className={propertySelectItemClass}>
            Unassigned
          </SelectItem>
          {assigneeSelectMembers
            .filter((m) => (canAssignSelf ? m.id !== currentUserId : true))
            .map((m) => (
              <SelectItem key={m.id} value={m.id} className={propertySelectItemClass}>
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
  );
}

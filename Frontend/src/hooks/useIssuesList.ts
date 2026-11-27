"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { apiJson } from "@/lib/api-client";
import { compareIssuesBoard, type BoardReorderEntry } from "@/lib/issue-board-sort";
import { orgIssuesQueryOptions } from "@/lib/query-org-sync";
import type { Issue } from "@/types/issue";
import { useOrganizationStore } from "@/stores/useOrganizationStore";

/** Pipeline filter shape; values are API tokens (status slugs, priority, label name, assignee: me|unassigned|userId). */
export type PipelineFilterState = {
  status: string[];
  priority: string[];
  label: string[];
  assignee: string[];
};

const emptyPipelineFilters = (): PipelineFilterState => ({
  status: [],
  priority: [],
  label: [],
  assignee: [],
});

function cloneFilters(f: PipelineFilterState): PipelineFilterState {
  return {
    status: [...f.status],
    priority: [...f.priority],
    label: [...f.label],
    assignee: [...f.assignee],
  };
}

let pipelineDraft: PipelineFilterState = emptyPipelineFilters();
let pipelineApplied: PipelineFilterState = emptyPipelineFilters();
let pipelineSnapshot: { draft: PipelineFilterState; applied: PipelineFilterState } = {
  draft: emptyPipelineFilters(),
  applied: emptyPipelineFilters(),
};

const pipelineListeners = new Set<() => void>();

function refreshPipelineSnapshot() {
  pipelineSnapshot = {
    draft: cloneFilters(pipelineDraft),
    applied: cloneFilters(pipelineApplied),
  };
}

function emitPipeline() {
  refreshPipelineSnapshot();
  pipelineListeners.forEach((l) => l());
}

function subscribePipelineFilters(cb: () => void) {
  pipelineListeners.add(cb);
  return () => pipelineListeners.delete(cb);
}

function getPipelineSnapshot() {
  return pipelineSnapshot;
}

export function syncPipelineDraftFromApplied() {
  pipelineDraft = cloneFilters(pipelineApplied);
  emitPipeline();
}

export function setPipelineDraft(next: PipelineFilterState) {
  pipelineDraft = cloneFilters(next);
  emitPipeline();
}

export function applyPipelineDraft() {
  pipelineApplied = cloneFilters(pipelineDraft);
  emitPipeline();
}

export function clearPipelineFilters() {
  pipelineDraft = emptyPipelineFilters();
  pipelineApplied = emptyPipelineFilters();
  emitPipeline();
}

export function togglePipelineDraftKey<K extends keyof PipelineFilterState>(
  key: K,
  value: string,
) {
  const arr = [...pipelineDraft[key]];
  const i = arr.indexOf(value);
  if (i === -1) arr.push(value);
  else arr.splice(i, 1);
  pipelineDraft = { ...pipelineDraft, [key]: arr };
  emitPipeline();
}

export function removeAppliedPipelineFilterValue(
  key: keyof PipelineFilterState,
  value: string,
) {
  pipelineApplied = {
    ...pipelineApplied,
    [key]: pipelineApplied[key].filter((x) => x !== value),
  };
  pipelineDraft = cloneFilters(pipelineApplied);
  emitPipeline();
}

export function usePipelineFilterStore() {
  return useSyncExternalStore(
    subscribePipelineFilters,
    getPipelineSnapshot,
    () => ({
      draft: emptyPipelineFilters(),
      applied: emptyPipelineFilters(),
    }),
  );
}

function serializeAppliedForQueryKey(applied: PipelineFilterState): string {
  return JSON.stringify({
    s: [...applied.status].sort(),
    p: [...applied.priority].sort(),
    l: [...applied.label].sort(),
    a: [...applied.assignee].sort(),
  });
}

export function buildIssuesListQueryString(applied: PipelineFilterState): string {
  const p = new URLSearchParams();
  if (applied.status.length) p.set("status", applied.status.join(","));
  if (applied.priority.length) p.set("priority", applied.priority.join(","));
  if (applied.label.length) p.set("label", applied.label.join(","));
  if (applied.assignee.length) p.set("assignee", applied.assignee.join(","));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function countAppliedPipelineFilters(applied: PipelineFilterState): number {
  return (
    applied.status.length +
    applied.priority.length +
    applied.label.length +
    applied.assignee.length
  );
}

export function formatAssigneeFilterChipLabel(
  value: string,
  membersById: Map<string, string>,
  currentUserId: string | null,
): string {
  if (value.toLowerCase() === "me") return "Me";
  if (value.toLowerCase() === "unassigned") return "Unassigned";
  if (currentUserId && value === currentUserId) return "Me";
  return membersById.get(value) ?? "Member";
}

/**
 * `null` = all issues. `""` = skip fetch (e.g. parent still resolving project).
 * `assignedToMe` filters server-side by the signed-in user (`assignee=me`); it ignores pipeline filters.
 */
export function useIssuesList(
  projectSlug: string | null | undefined,
  opts?: { applyPipelineFilters?: boolean; assignedToMe?: boolean },
) {
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const queryClient = useQueryClient();
  const assignedToMe = Boolean(opts?.assignedToMe);
  const applyPipelineFilters = !assignedToMe && Boolean(opts?.applyPipelineFilters);
  const { applied } = usePipelineFilterStore();

  const slugKey = projectSlug === "" ? "__skip__" : projectSlug == null ? "__all__" : projectSlug;
  const pipelineKey = assignedToMe
    ? "__assignee_me__"
    : applyPipelineFilters
      ? serializeAppliedForQueryKey(applied)
      : "__no_pipeline_filters__";

  const query = useQuery({
    queryKey: ["issues", organizationId, slugKey, pipelineKey],
    enabled: Boolean(organizationId) && projectSlug !== "",
    ...orgIssuesQueryOptions(),
    queryFn: async ({ queryKey }) => {
      const q = assignedToMe
        ? "?assignee=me"
        : applyPipelineFilters && countAppliedPipelineFilters(applied) > 0
          ? buildIssuesListQueryString(applied)
          : "";
      const path =
        projectSlug != null
          ? `/api/projects/${encodeURIComponent(projectSlug)}/issues${q}`
          : `/api/issues${q}`;
      const r = await apiJson<Issue[]>(path, { orgId: queryKey[1] });
      if (!r.success) throw new Error(r.error);
      return r.data;
    },
  });

  const patchStatus = useCallback(
    async (issueId: string, status: string, slug: string) => {
      const r = await apiJson<Issue>(
        `/api/projects/${encodeURIComponent(slug)}/issues/${encodeURIComponent(issueId)}`,
        { method: "PATCH", body: { status } },
      );
      if (r.success) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["issues", organizationId], exact: false }),
          queryClient.invalidateQueries({ queryKey: ["issue", organizationId, issueId] }),
        ]);
      }
    },
    [organizationId, queryClient],
  );

  /** Move one card: a single PATCH (status + sortOrder), optimistic with rollback via refetch. */
  const reorderBoard = useCallback(
    async (update: BoardReorderEntry) => {
      if (!organizationId) return;
      await queryClient.cancelQueries({ queryKey: ["issues", organizationId], exact: false });

      queryClient.setQueriesData<Issue[]>(
        { queryKey: ["issues", organizationId], exact: false },
        (old) => {
          if (!old) return old;
          const merged = old.map((issue) =>
            issue.id === update.issueId
              ? { ...issue, status: update.status as Issue["status"], sortOrder: update.sortOrder }
              : issue,
          );
          return [...merged].sort(compareIssuesBoard);
        },
      );

      const r = await apiJson<Issue>(
        `/api/projects/${encodeURIComponent(update.projectSlug)}/issues/${encodeURIComponent(update.issueId)}`,
        { method: "PATCH", body: { status: update.status, sortOrder: update.sortOrder } },
      );
      if (r.success) {
        await queryClient.invalidateQueries({
          queryKey: ["issue", organizationId, update.issueId],
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["issues", organizationId], exact: false });
      if (!r.success) throw new Error(r.error || "Reorder failed");
    },
    [organizationId, queryClient],
  );

  return {
    issues: query.data ?? [],
    loading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    patchStatus,
    reorderBoard,
    appliedPipelineFilters: applyPipelineFilters ? applied : emptyPipelineFilters(),
  };
}

refreshPipelineSnapshot();

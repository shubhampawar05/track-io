"use client";

import { useQuery } from "@tanstack/react-query";
import { apiJsonWithStatus } from "@/lib/api-client";
import type { ProjectDetail } from "@/types/issue";
import { useOrganizationStore } from "@/stores/useOrganizationStore";

/** Cache key for a single project. The cached value is always a bare `ProjectDetail`. */
export function projectDetailQueryKey(organizationId: string | null, slug: string) {
  return ["project", organizationId, slug] as const;
}

/** Failed project fetch; `status` lets callers skip retrying client errors (403/404). */
export class ProjectDetailError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ProjectDetailError";
  }
}

export async function fetchProjectDetail(
  slug: string,
  organizationId: string | null,
): Promise<ProjectDetail> {
  const { status, payload: r } = await apiJsonWithStatus<ProjectDetail>(
    `/api/projects/${encodeURIComponent(slug)}`,
    { orgId: organizationId },
  );
  if (!r.success) throw new ProjectDetailError(r.error, status);
  return r.data;
}

/** Retry network/5xx failures (TanStack default of 3), but not 4xx: those will not recover. */
function retryProjectDetail(failureCount: number, error: Error): boolean {
  if (error instanceof ProjectDetailError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 3;
}

/** Project detail for the active organization. Pass `""`/`null` for slug to skip fetching. */
export function useProjectDetail(
  slug: string | null | undefined,
  opts?: { enabled?: boolean },
) {
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const s = slug ?? "";
  return useQuery({
    queryKey: projectDetailQueryKey(organizationId, s),
    enabled: Boolean(s && organizationId) && (opts?.enabled ?? true),
    queryFn: ({ queryKey }) => fetchProjectDetail(queryKey[2], queryKey[1]),
    retry: retryProjectDetail,
  });
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import type { ProjectDetail } from "@/types/issue";
import { useOrganizationStore } from "@/stores/useOrganizationStore";

/** Cache key for a single project. The cached value is always a bare `ProjectDetail`. */
export function projectDetailQueryKey(organizationId: string | null, slug: string) {
  return ["project", organizationId, slug] as const;
}

export async function fetchProjectDetail(
  slug: string,
  organizationId: string | null,
): Promise<ProjectDetail> {
  const r = await apiJson<ProjectDetail>(`/api/projects/${encodeURIComponent(slug)}`, {
    orgId: organizationId,
  });
  if (!r.success) throw new Error(r.error);
  return r.data;
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
  });
}

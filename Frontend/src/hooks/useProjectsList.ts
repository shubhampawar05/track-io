"use client";

import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import type { ProjectCard } from "@/types/issue";
import { useOrganizationStore } from "@/stores/useOrganizationStore";

export function useProjectsList() {
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const query = useQuery({
    queryKey: ["projects", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async ({ queryKey }) => {
      const r = await apiJson<ProjectCard[]>("/api/projects", { orgId: queryKey[1] });
      if (!r.success) throw new Error(r.error);
      return r.data;
    },
  });
  return {
    projects: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  };
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import { orgInvitesListQueryOptions, orgMembersListQueryOptions } from "@/lib/query-org-sync";
import type { OrganizationInviteRow, OrganizationMember } from "@/types/issue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOrganizationStore } from "@/stores/useOrganizationStore";

export function useOrganizationMembersQuery() {
  const organizationId = useOrganizationStore((s) => s.organizationId);
  return useQuery({
    queryKey: ["organization", "members", organizationId],
    enabled: Boolean(organizationId),
    ...orgMembersListQueryOptions(),
    queryFn: async ({ queryKey }) =>
      apiJson<OrganizationMember[]>("/api/organizations/members", { orgId: queryKey[2] }),
  });
}

export function useOrganizationInvitesQuery() {
  const organizationId = useOrganizationStore((s) => s.organizationId);
  const organizations = useAuthStore((s) => s.organizations);
  const role = organizations.find((o) => o.id === organizationId)?.role;
  const canManageInvites = role === "owner" || role === "admin";

  return useQuery({
    queryKey: ["organization", "invites", organizationId],
    enabled: Boolean(organizationId) && canManageInvites,
    ...orgInvitesListQueryOptions(),
    queryFn: async ({ queryKey }) =>
      apiJson<OrganizationInviteRow[]>("/api/organizations/invites", { orgId: queryKey[2] }),
  });
}

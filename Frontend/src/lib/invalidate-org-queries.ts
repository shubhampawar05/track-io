import type { Query, QueryClient } from "@tanstack/react-query";
import { clearPipelineFilters } from "@/hooks/useIssuesList";
import { useOrganizationStore } from "@/stores/useOrganizationStore";

/** Query-key roots whose cached data belongs to a single organization. */
const ORG_SCOPED_ROOTS = new Set([
  "projects",
  "issues",
  "issue",
  "organization",
  "github-integration",
  "project",
  "activeSprint",
  "issuesBoardColumns",
  "projectBoardColumns",
]);

function isOrgScoped(query: Query): boolean {
  const root = query.queryKey[0];
  return typeof root === "string" && ORG_SCOPED_ROOTS.has(root);
}

/** Broad invalidation when active workspace changes (org id is embedded in many query keys). */
export function invalidateOrganizationScopedQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ predicate: isOrgScoped });
}

/**
 * Switch the active workspace: drop every org-scoped query that is not keyed by the next org
 * (cancelling in-flight fetches so they can't land in the old org's cache), reset per-workspace
 * UI state, then make `nextOrgId` active and refresh anything cached for it.
 */
export async function switchActiveOrganization(
  queryClient: QueryClient,
  nextOrgId: string,
): Promise<void> {
  const notNextOrg = (q: Query) => isOrgScoped(q) && !q.queryKey.includes(nextOrgId);
  await queryClient.cancelQueries({ predicate: notNextOrg });
  queryClient.removeQueries({ predicate: notNextOrg });
  clearPipelineFilters();
  useOrganizationStore.getState().setOrganizationId(nextOrgId);
  invalidateOrganizationScopedQueries(queryClient);
}

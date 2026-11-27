import type { QueryClient } from "@tanstack/react-query";

/** Broad invalidation when active workspace changes (org id is embedded in many query keys). */
export function invalidateOrganizationScopedQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["projects"] });
  void queryClient.invalidateQueries({ queryKey: ["issues"] });
  void queryClient.invalidateQueries({ queryKey: ["issue"] });
  void queryClient.invalidateQueries({ queryKey: ["organization"] });
  void queryClient.invalidateQueries({ queryKey: ["github-integration"] });
  void queryClient.invalidateQueries({ queryKey: ["project"] });
  void queryClient.invalidateQueries({ queryKey: ["activeSprint"] });
}

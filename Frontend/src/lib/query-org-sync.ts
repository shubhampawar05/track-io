/** Members list: rely on focus/reconnect + invalidations; modest staleTime avoids refetch churn. */
export function orgMembersListQueryOptions() {
  return {
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  } as const;
}

/** Invites list: still fresh on focus; slower background poll for cross-tab accept/decline. */
export function orgInvitesListQueryOptions() {
  return {
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60_000,
  } as const;
}

/** Issues list: refetch on focus without polling (lighter load). */
export function orgIssuesQueryOptions() {
  return {
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  } as const;
}
